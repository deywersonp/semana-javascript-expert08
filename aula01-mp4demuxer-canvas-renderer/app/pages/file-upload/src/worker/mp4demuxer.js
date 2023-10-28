import { DataStream, createFile } from "../deps/mp4box.0.5.2.js"

export default class MP4Demuxer {
  #onConfig
  #onChunk
  #file

  /**
   * 
   * @param {ReadableStream} stream 
   * @param {object} options
   * @param {(config: object) => void} options.onConfig
   * 
   * @returns {Promise<void>}
   */

  async run(stream, { onConfig, onChunk }) {
    this.#onConfig = onConfig
    this.#onChunk = onChunk

    this.#file = createFile()
    this.#file.onReady = this.#onReady.bind(this)

    //Samples are the video frames
    this.#file.onSamples = this.#onSamples.bind(this)

    this.#file.onError = (error) => {
      console.error('deu ruim mp4Demuxer', error)
    }

    return this.#init(stream)
  }

  //This is from Codecs API Example. We need this code to retrieve the necessary information
  //when using mp4Box with demuxer with Video Encoder native from our navigator
  #description({ id }) {
    const track = this.#file.getTrackById(id)
    for (const entry of track.mdia.minf.stbl.stsd.entries) {
      const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C
      if (box) {
        const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN)
        box.write(stream)
        return new Uint8Array(stream.buffer, 8) //Remove the box header
      }
    }
  }

  //By default the mp4Box process 1000 frames per second
  #onSamples(trackId, ref, samples) {
    debugger
  }

  #onReady(info) {
    const [track] = info.videoTracks
    //This config will pass the necessary information to the Encoder from navigator,
    //this way the navigator can work with this video
    //The object passed on onConfig follows the pattern asked on 
    //https://developer.mozilla.org/en-US/docs/Web/API/VideoDecoder/configure
    //On this link above we can check for what end each property is used
    this.#onConfig({
      codec: track.codec,
      codedHeight: track.video.height,
      codedWidth: track.video.width,
      description: this.#description(track),
      durationSecs: info.duration / info.timescale,
    })
    this.#file.setExtractionOptions(track.id)
    //The start method initialize the data extraction and segmentation
    this.#file.start()
  }

  /**
   * 
   * @param {ReadableStream} stream 
   * @returns {Promise<void>}
   */

  #init(stream) {
    //The MP4Box Library require that we tell him from where we want to start
    //reading the file. We set this value to zero.
    let _offset = 0

    //WritableStream is used to consume data. On data received, we can do whatever we want
    //like console.log the data or pass the data forward
    const consumeFile = new WritableStream({
      //The functions below have the 2 dots cause without the dots the "this" use as reference 
      //the stream, but when we add the 2 dots the new reference is the class
      /**
       * @param {Uint8Array} chunk
       */
      write: (chunk) => {
        const copy = chunk.buffer
        //Required from MP4Box
        copy.fileStart = _offset

        this.#file.appendBuffer(copy)

        _offset += chunk.length
      },
      close: () => {
        //After reading the file we take it out of the memory
        this.#file.flush()
      }
    })

    return stream.pipeTo(consumeFile)
  }
}