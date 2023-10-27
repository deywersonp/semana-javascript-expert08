onmessage = ({ data }) => {
  console.log('recebido!!', data)
  self.postMessage('hey from work')
}