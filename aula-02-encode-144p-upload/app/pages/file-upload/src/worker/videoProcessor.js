export default class VideoProcessor {
  #mp4Demuxer
  #webMWriter
  #service
  #buffers = []
  //We are receiving the mp4Demuxer using dependency injection
  //The injection is made by the worker.js file
  /**
   * 
   * @param {object} options
   * @param {import('./mp4demuxer.js').default} options.mp4Demuxer
   * @param {import('./../deps/webm-writer2.js').default} options.webMWriter
   * @param {import('./service.js').default} options.service
   */
  constructor({ mp4Demuxer, webMWriter, service }) {
    this.#mp4Demuxer = mp4Demuxer
    this.#webMWriter = webMWriter
    this.#service = service
  }

  /**
 * @returns {ReadableStream}
 * */
  mp4Decoder(stream) {
    return new ReadableStream({
      //Who consumes this function will receive what the controller sends
      start: async (controller) => {
        const decoder = new VideoDecoder({
          /**
           * @param {VideoFrame} frame
           * */
          output(frame) {
            //Every time that we process a frame successfully we are
            //forwarding the decoded data, on demand
            controller.enqueue(frame)
          },
          error(e) {
            console.error('error at mp4Decoder', e)
            controller.error(e)
          }
        })

        return this.#mp4Demuxer.run(stream,
          {
            async onConfig(config) {
              //Something in this suport validation is triggering a silent error
              //that dont demuxer files with bigger size. Because of that we commented
              //this code
              // const { supported } = await VideoDecoder.isConfigSupported(config)

              // if (!supported) {
              //   console.error('mp4Muxer VideoDecoder config is not supported!', config)
              //   controller.close()
              //   return
              // }

              decoder.configure(config)
            },
            /**
             * @param {EncodedVideoChunk} chunk 
             * */
            onChunk(chunk) {
              //Every time that decode is called, the output from decoder variable is called
              //this will happen for each frame
              decoder.decode(chunk)
            }
          }
        )
        // .then(() => {
        //   setTimeout(() => {
        //     controller.close()
        //   }, 3000)
        // })
      }
    })
  }

  encode144p(encoderConfig) {
    let _encoder

    //The same result as mp4Decoder, but with a different approach
    //Here is where the data will be accessed
    //Used to create a data source; We can use this to pipe to another place
    const readable = new ReadableStream({
      start: async (controller) => {
        const { supported } = await VideoEncoder.isConfigSupported(encoderConfig)

        //Other way to handler the supported error is using controller.error
        if (!supported) {
          const message = 'encode144p VideoEncoder config not supported!'
          console.error(message, encoderConfig)
          controller.error(message)
          return
        }

        _encoder = new VideoEncoder({
          /**
           * 
           * @param {EncodedVideoChunk} frame 
           * @param {EncodedVideoChunkMetadata} config 
           */
          output: (frame, config) => {
            //We'll pass the decoder config forward cause we need to decoder the video
            //to render the frames on canvas element
            if (config.decoderConfig) {
              const decoderConfig = {
                type: 'config',
                config: config.decoderConfig
              }

              controller.enqueue(decoderConfig)
            }

            controller.enqueue(frame)
          },
          error: (err) => {
            console.error('VideoEncoder 144p', err)
            controller.error(err)
          }
        })

        await _encoder.configure(encoderConfig)
      }
    })

    //Here is where the data are received and written
    const writable = new WritableStream({
      async write(frame) {
        //When each frame from encode is ready, the data will be moved to the output inside the readable
        _encoder.encode(frame)
        frame.close()
      }
    })

    //Returning readable and writable config a duplex: A channel where we can 
    //listen data and a channel where we can write data
    return {
      readable,
      writable
    }
  }

  renderDecodedFramesAndGetEncodedChunks(renderFrame) {
    let _decoder
    //TransformStream is a writable AND readable stream. The difference from the example 
    //above is that we create manually a TransformStream, and now we are using the constructor
    return new TransformStream({
      start: (controller) => {
        _decoder = new VideoDecoder({
          output(frame) {
            renderFrame(frame)
          },
          error(e) {
            console.error('error at renderFrames', e)
            controller.error(e)
          }
        })
      },
      //On TransformStream we have the transform method. Each frame will drop here
      //This transform function will be hit twice by frame, one with the config and other with
      //the real frame
      /**
       * 
       * @param {EncodedVideoChunk} encodedChunk 
       * @param {TransformStreamDefaultController} controller 
       */
      async transform(encodedChunk, controller) {
        if (encodedChunk.type === 'config') {
          await _decoder.configure(encodedChunk.config)
          return
        }

        _decoder.decode(encodedChunk)

        //need the encoded version to use webM
        controller.enqueue(encodedChunk)
      }
    })
  }

  transformIntoWebM() {
    const writable = new WritableStream({
      write: (chunk) => {
        this.#webMWriter.addFrame(chunk)
      },
      close() {
        debugger
      }
    })
    return {
      readable: this.#webMWriter.getStream(),
      writable
    }
  }
  //The UPLOAD will be the last process, so, for the last process, we have to return an writable
  upload(filename, resolution, type) {
    const chunks = []
    let byteCount = 0
    let segmentCount = 0

    const triggerUpload = async chunks => {
      const blob = new Blob(
        chunks,
        { type: 'video/webm' }
      )

      await this.#service.uploadFile({
        filename: `${filename}-${resolution}.${++segmentCount}.${type}`,
        fileBuffer: blob
      })

      //Clean all elements
      chunks.length = 0
      byteCount = 0
    }

    return new WritableStream({
      /**
       * 
       * @param {object} options
       * @param {Uint8Array} options.data
       */
      async write({ data }) {
        chunks.push(data)
        byteCount += data.byteLength

        //If byteCount smaller than 10MB do not UPLOAD
        if (byteCount <= 10e6) return
        await triggerUpload(chunks)
      },
      async close() {
        //If stream completed, OK
        if (!chunks.length) return;
        //If the file size is smaller than 10MB and the stream are ready to close
        //We do the UPLOAD
        await triggerUpload(chunks)
      }
    })
  }

  async start({ file, encoderConfig, renderFrame, sendMessage }) {
    const stream = file.stream()
    const filename = file.name.split('/').pop().replace('.mp4', '')
    await this.mp4Decoder(stream)
      .pipeThrough(this.encode144p(encoderConfig))
      //The second pipe receive the frame encoded to 144p and the decoder config
      //With this 2 datas we can decoder the frame to render on the canvas element
      .pipeThrough(this.renderDecodedFramesAndGetEncodedChunks(renderFrame))
      .pipeThrough(this.transformIntoWebM())
      // //This step is just for debugger purposes and is not recommended for production.
      // //The main reason is because the file size can be very large and will make 
      // //a big memory occupation
      // .pipeThrough(
      //   new TransformStream({
      //     transform: ({ data, position }, controller) => {
      //       this.#buffers.push(data)
      //       controller.enqueue(data)
      //     },
      //     //Flush is called when the process completes
      //     flush: () => {
      //       //To download file works we have to send the buffers and filename
      //       // sendMessage({
      //       //   status: 'done',
      //       //   buffers: this.#buffers,
      //       //   filename: filename.concat('-144p.webm')
      //       // })

      //       sendMessage({
      //         status: 'done',
      //       })
      //     }
      //   })
      // )
      // .pipeTo(new WritableStream({
      //   write(frame) {
      //     // debugger
      //   }
      // }))
      .pipeTo(this.upload(filename, '144p', 'webm'))

    sendMessage({ status: 'done' })
  }
}