export default class VideoProcessor {
  #mp4Demuxer

  //We are receiving the mp4Demuxer using dependency injection
  //The injection is made by the worker.js file
  /**
   * 
   * @param {object} options
   * @param {import('./mp4demuxer.js').default} options.mp4Demuxer
   */
  constructor({ mp4Demuxer }) {
    this.#mp4Demuxer = mp4Demuxer
  }

  /**
 * @returns {ReadableStream}
 * */
  mp4Decoder(encoderConfig, stream) {
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
            onConfig(config) {
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
        ).then(() => {
          setTimeout(() => {
            controller.close()
          }, 1000)
        })
      }
    })
  }

  async start({ file, encoderConfig, renderFrame }) {
    const stream = file.stream()
    const fileName = file.name.split('/').pop().replace('.mp4', '')
    await this.mp4Decoder(encoderConfig, stream)
      .pipeTo(new WritableStream({
        write(frame) {
          renderFrame(frame)
        }
      }))
  }
}