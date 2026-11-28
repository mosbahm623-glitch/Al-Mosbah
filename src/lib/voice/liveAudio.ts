import { fromPcm, toPcm } from './pcm'

const MIC = `registerProcessor('mic', class extends AudioWorkletProcessor {
  chunk = []
  size = 0
  process([input]) {
    if (input[0]) {
      this.chunk.push(input[0].slice())
      this.size += input[0].length
      if (this.size >= sampleRate / 25) {
        const all = new Float32Array(this.size)
        this.chunk.reduce((at, part) => (all.set(part, at), at + part.length), 0)
        this.port.postMessage(all, [all.buffer])
        this.chunk = []
        this.size = 0
      }
    }
    return true
  }
})`

/** Microphone in and the model's voice out. `listen` starts sending, 40ms at a time. */
export async function openAudio() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
  })
  const context = new AudioContext()
  const playing = new Set<AudioBufferSourceNode>()
  let next = 0
  let closed = false
  // loaded while the call is still connecting, so the microphone starts the moment it opens
  const url = URL.createObjectURL(new Blob([MIC], { type: 'text/javascript' }))
  const loaded = context.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url))
  loaded.catch(() => undefined) // reported by `listen`

  return {
    async listen(send: (pcm: string) => void) {
      await loaded
      await context.resume()
      if (closed) return
      const node = new AudioWorkletNode(context, 'mic')
      node.port.onmessage = (e: MessageEvent<Float32Array>) => send(toPcm(e.data, context.sampleRate))
      context.createMediaStreamSource(stream).connect(node)
      node.connect(context.destination) // it plays nothing; connected so the browser keeps running it
    },
    play(data: string) {
      const samples = fromPcm(data)
      if (closed || !samples.length) return
      const buffer = context.createBuffer(1, samples.length, 24_000)
      buffer.copyToChannel(samples, 0)
      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(context.destination)
      source.onended = () => playing.delete(source)
      next = Math.max(next, context.currentTime)
      source.start(next)
      next += buffer.duration
      playing.add(source)
    },
    /** The person spoke over the model: stop its voice at once. */
    hush() {
      playing.forEach((s) => s.stop())
      playing.clear()
      next = 0
    },
    close() {
      if (closed) return
      closed = true
      stream.getTracks().forEach((t) => t.stop())
      void context.close()
    },
  }
}
