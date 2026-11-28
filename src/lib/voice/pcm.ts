/** Microphone samples at any rate, as the base64 16-bit PCM at `to` Hz that the live call takes. */
export function toPcm(samples: Float32Array, from: number, to = 16_000) {
  const length = Math.floor((samples.length * to) / from)
  const view = new DataView(new ArrayBuffer(length * 2))
  const step = from / to
  for (let i = 0; i < length; i++) {
    // the average of the samples this one replaces, so high sounds don't turn into noise
    const start = Math.floor(i * step)
    const end = Math.max(start + 1, Math.floor((i + 1) * step))
    let sum = 0
    for (let j = start; j < end; j++) sum += samples[j]
    const v = Math.max(-1, Math.min(1, sum / (end - start)))
    view.setInt16(i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true)
  }
  return toBase64(new Uint8Array(view.buffer))
}

/** The other way: base64 16-bit PCM as samples that can be played. */
export function fromPcm(data: string) {
  const binary = atob(data)
  const view = new DataView(new ArrayBuffer(binary.length - (binary.length % 2)))
  for (let i = 0; i < view.byteLength; i++) view.setUint8(i, binary.charCodeAt(i))
  const samples = new Float32Array(view.byteLength / 2)
  for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 0x8000
  return samples
}

function toBase64(bytes: Uint8Array) {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}
