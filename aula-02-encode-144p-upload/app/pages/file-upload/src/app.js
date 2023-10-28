import Clock from './deps/clock.js';
import View from './view.js';

const view = new View()
const clock = new Clock()

const worker = new Worker('./src/worker/worker.js', {
    type: 'module'
})

worker.onerror = (error) => {
    console.error('error worker', error)
}

worker.onmessage = ({ data }) => {
    if (data.status !== 'done') return
    clock.stop()
    view.updateElapsedTime(`Process took ${took.replace('ago', '')}`)

    if (!data.buffers) return

    view.downloadBlobAsFile(
        data.buffers,
        data.filename,
    )
}

let took = ''

view.configureOnFileChange(file => {
    const canvas = view.getCanvas()

    worker.postMessage({
        file,
        canvas,
        //Required inform that this subprocess will be a transferable from the main
        //process to the secondary process. Doing this we can update the view from
        //the secondary process. Work for only few elements
    }, [
        canvas
    ])

    clock.start((time) => {
        took = time;
        view.updateElapsedTime(`Process started ${time}`)
    })
})

async function fakeFetch() {
    const filePath = "/videos/frag_bunny.mp4"
    const response = await fetch(filePath)

    // Using the head method we can use headers gets.
    // For example, to get the file size on console, 
    // using response.headers.get() and passing the property name

    // const response = await fetch(filePath, {
    //     method: "HEAD",
    // })
    // response.headers.get('content-length')
    // return '5524488'

    const file = new File([await response.blob()], filePath, {
        type: 'video/mp4',
        lastModified: Date.now(),
    })

    const event = new Event('change')
    Reflect.defineProperty(
        event,
        'target',
        { value: { files: [file] } }
    )

    document.getElementById('fileUpload').dispatchEvent(event)
}

// fakeFetch()