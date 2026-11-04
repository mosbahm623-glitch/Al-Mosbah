// The notification sound: a short rising "lamp bell" (A major arpeggio) generated in the browser,
// so no audio file has to be shipped or downloaded.
const KEY = 'mosbah-chime'

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext }

let ctx: AudioContext | null = null

function context(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext
  if (!Ctor) return null
  ctx = new Ctor()
  return ctx
}

export function isChimeOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export function setChimeOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* ignore */
  }
}

/** Browsers keep sound locked until the person touches the page once: unlock it on the first touch/click/key. */
export function unlockChime(): () => void {
  const unlock = () => {
    const c = context()
    if (c && c.state === 'suspended') void c.resume()
  }
  const events = ['pointerdown', 'keydown', 'touchstart'] as const
  for (const e of events) window.addEventListener(e, unlock, { passive: true })
  return () => {
    for (const e of events) window.removeEventListener(e, unlock)
  }
}

// A5 major arpeggio: E5, A5, C#6, then a soft high sparkle on E6
const NOTES = [
  { freq: 659.25, at: 0, ring: 0.5 },
  { freq: 880.0, at: 0.13, ring: 0.5 },
  { freq: 1108.73, at: 0.26, ring: 0.7 },
  { freq: 1318.51, at: 0.4, ring: 1.3 },
]

function bell(c: AudioContext, freq: number, start: number, ring: number, peak: number) {
  // body (pure tone) + one quiet octave overtone = a clear, glassy bell
  for (const [mult, level] of [
    [1, 1],
    [2, 0.3],
  ] as const) {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq * mult
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(peak * level, start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + ring)
    osc.connect(gain).connect(c.destination)
    osc.start(start)
    osc.stop(start + ring + 0.05)
  }
}

/** Plays the notification sound (does nothing when it is muted or the browser still blocks sound). */
export function playChime(force = false) {
  if (!force && !isChimeOn()) return
  const c = context()
  if (!c) return
  const run = () => {
    const t = c.currentTime + 0.02
    NOTES.forEach((n, i) => bell(c, n.freq, t + n.at, n.ring, i === NOTES.length - 1 ? 0.12 : 0.2))
  }
  if (c.state === 'suspended') void c.resume().then(run, () => undefined)
  else run()
}
