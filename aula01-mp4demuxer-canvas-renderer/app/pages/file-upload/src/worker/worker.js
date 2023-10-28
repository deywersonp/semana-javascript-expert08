import CanvasRenderer from "./canvasRenderer.js"
import MP4Demuxer from "./mp4demuxer.js"
import VideoProcessor from "./videoProcessor.js"
//This constraints are the video resolution
//144p
const qvgaConstraints = {
  width: 320,
  height: 240
}

// const vgaConstraints = {
//   width: 640,
//   height: 480
// }

// //HD
// const hdConstraints = {
//   width: 1200,
//   height: 720
// }

//This config pattern comes from Video Codec API Github Example
const encoderConfig = {
  ...qvgaConstraints,
  bitrate: 10e6, //1MB
  //WebM - Config from Codec API Github Example
  codec: 'vp09.00.10.08',
  pt: 4,
  hardwareAcceleration: 'prefer-software',

  //MP4 - Config from Codec API Github Example
  // codec: 'avc1.42002A',
  // pt: 1,
  // hardwareAcceleration: 'prefer-hardware',
  // avc: { format: 'annexb' },
}

const mp4Demuxer = new MP4Demuxer()
const videoProcessor = new VideoProcessor({
  mp4Demuxer
})

onmessage = async ({ data }) => {
  const renderFrame = CanvasRenderer.getRenderer(data.canvas)

  await videoProcessor.start({
    file: data.file,
    renderFrame,
    encoderConfig,
  })

  self.postMessage({
    status: 'done'
  })
}