import { createFile } from "../deps/mp4box.0.5.2.js"

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

    this.#file.onReady = (args) => {
      debugger
    }

    this.#file.onError = (error) => {
      console.error('deu ruim mp4Demuxer', error)
    }

    return this.#init(stream)
  }

  /**
   * 
   * @param {ReadableStream} stream 
   * @returns {Promise<void>}
   */

  #init(stream) {
    //WritableStream is used to consume data. On data received, we can do whatever we want
    //like console.log the data or pass the data forward
    const consumeFile = new WritableStream({
      //The functions below have the 2 dots cause without the dots the "this" use as reference 
      //the stream, but when we add the 2 dots the new reference is the class
      /**
       * @param {Uint8Array} chunk
       */
      write: (chunk) => {
        debugger
      },
      close: () => {
        debugger
      }
    })

    return stream.pipeTo(consumeFile)
  }
}