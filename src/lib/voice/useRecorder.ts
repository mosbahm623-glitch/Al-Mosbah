import { useCallback, useEffect, useRef, useState } from 'react'
import { encodeWav, toBase64 } from './wav'

const RATE = 16_000
const MAX_SECONDS = 120

/** Whatever the browser recorded (webm, mp4...) as a small 16 kHz mono WAV, which the model accepts everywhere. */
async function asWavBase64(blob: Blob) {
  const context = new AudioContext()
  try {
    const audio = await context.decodeAudioData(await blob.arrayBuffer())
    const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(audio.duration * RATE)), RATE)
    const source = offline.createBufferSource()
    source.buffer = audio
    source.connect(offline.destination)
    source.start()
    const mono = await offline.startRendering()
    return toBase64(encodeWav(mono.getChannelData(0), RATE))
  } finally {
    void context.close()
  }
}

/** Tap to start, tap to stop (or it stops by itself after MAX_SECONDS); `onDone` gets the WAV as base64. */
export function useRecorder(onDone: (wav: string) => void, onFail: (message: string) => void) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const starting = useRef(false)
  const alive = useRef(true)
  const handlers = useRef({ onDone, onFail })
  useEffect(() => {
    handlers.current = { onDone, onFail }
  })

  const stop = useCallback(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }, [])

  const start = useCallback(async () => {
    if (starting.current || recorder.current?.state === 'recording') return
    starting.current = true
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const release = () => stream.getTracks().forEach((t) => t.stop())
      if (!alive.current) return release()
      const rec = new MediaRecorder(stream)
      const chunks: Blob[] = []
      rec.ondataavailable = (e) => chunks.push(e.data)
      rec.onstop = () => {
        release()
        if (!alive.current) return
        setRecording(false)
        asWavBase64(new Blob(chunks, { type: rec.mimeType })).then(
          (wav) => handlers.current.onDone(wav),
          () => handlers.current.onFail('التسجيل ما اتقراش، جرّب تاني'),
        )
      }
      recorder.current = rec
      rec.start()
      setSeconds(0)
      setRecording(true)
    } catch {
      handlers.current.onFail('مقدرتش أفتح المايك. اسمح للتطبيق يستخدمه من إعدادات المتصفح')
    } finally {
      starting.current = false
    }
  }, [])

  useEffect(() => {
    if (!recording) return
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [recording])

  useEffect(() => {
    if (seconds >= MAX_SECONDS) stop()
  }, [seconds, stop])

  // leaving the page closes the microphone and drops what was being recorded
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      stop()
    }
  }, [stop])

  return { recording, seconds, start, stop }
}
