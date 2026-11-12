import { useEffect, useMemo, useRef, useState } from 'react'
import { Mic, MicOff, Send } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import Dialog from './Dialog'
import { askAgent, describeWrite, runTool, WRITE_TOOLS, type Content, type ToolCall } from '../lib/agent'
import { fetchSummaries, type ProjectSummary } from '../lib/projects'
import { parseCommand } from '../lib/voiceCommand'
import { useAsync } from '../lib/useAsync'

type Recognition = {
  lang: string
  interimResults: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}
const speech = (): (new () => Recognition) | null => {
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition
    webkitSpeechRecognition?: new () => Recognition
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const EXAMPLES = [
  'سجّل ٣٠ ألف لخالد النقاش على الجندي من البنك الأهلي',
  'كام الباقي لخالد النقاش في العيادة؟',
  'وافق على قيود العيادة',
  'افتح تقرير الجندي',
]
const MAX_STEPS = 8

type Line = { who: 'me' | 'bot'; text: string }
type Ask = { text: string; resolve: (ok: boolean) => void }

const todayText = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** A chat with an AI agent: it looks things up, opens pages, and (after you confirm) records entries and approves. */
export default function VoiceAssistant({ onClose }: { onClose: () => void }) {
  const { isAdmin, isOwner, can } = useAuth()
  const projects = useAsync<ProjectSummary[]>(fetchSummaries)
  const [text, setText] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [ask, setAsk] = useState<Ask | null>(null)
  const rec = useRef<Recognition | null>(null)
  const history = useRef<Content[]>([])
  const endRef = useRef<HTMLDivElement>(null)
  const canSpeak = useMemo(() => speech() !== null, [])
  const mayEnter = isAdmin || isOwner || can('projects', 'edit')
  const names = useMemo(() => new Map((projects.data ?? []).map((p) => [p.id, p.name])), [projects.data])

  useEffect(() => () => rec.current?.stop(), [])
  useEffect(() => endRef.current?.scrollIntoView({ block: 'end' }), [lines, ask])

  const say = (who: Line['who'], t: string) => setLines((l) => [...l, { who, text: t }])
  const go = (path: string) => {
    window.location.hash = `#/${path}`
    onClose()
  }

  function confirm(t: string) {
    return new Promise<boolean>((resolve) => setAsk({ text: t, resolve }))
  }

  async function send(input: string) {
    const q = input.trim()
    if (!q || busy) return
    setText('')
    say('me', q)

    // the plain ones need no AI
    const fixed = parseCommand(q, [])
    if (fixed.intent === 'close') return onClose()
    if (fixed.intent === 'open' && !fixed.path.startsWith('projects/')) return go(fixed.path)

    setBusy(true)
    history.current.push({ role: 'user', parts: [{ text: q }] })
    try {
      for (let step = 0; step < MAX_STEPS; step++) {
        const { data, error } = await askAgent(history.current, todayText())
        if (error || !data?.parts) {
          say('bot', 'الذكاء الاصطناعي مش متاح دلوقتي، جرّب بعد شوية.')
          history.current.pop()
          return
        }
        const parts = data.parts as Content['parts']
        history.current.push({ role: 'model', parts })
        const said = parts
          .filter((p) => typeof p.text === 'string' && !p.thought)
          .map((p) => p.text as string)
          .join('')
          .trim()
        if (said) say('bot', said)
        const calls = parts.filter((p) => p.functionCall).map((p) => p.functionCall as ToolCall)
        if (!calls.length) return

        const answers: Content['parts'] = []
        for (const call of calls) {
          call.args = call.args ?? {}
          let result: Record<string, unknown>
          if (WRITE_TOOLS.has(call.name) && !(await confirm(await describeWrite(call, names)))) {
            result = { declined: true, note: 'المستخدم رفض التنفيذ.' }
          } else {
            result = await runTool(call, { isAdmin, mayEnter, today: todayText(), go })
          }
          answers.push({ functionResponse: { name: call.name, ...(call.id ? { id: call.id } : {}), response: result } })
        }
        history.current.push({ role: 'user', parts: answers })
      }
      say('bot', 'الموضوع طوّل. قولّي تاني بشكل أبسط.')
    } finally {
      setBusy(false)
      setAsk(null)
    }
  }

  function listen() {
    const Ctor = speech()
    if (!Ctor) return
    if (listening) return rec.current?.stop()
    const r = new Ctor()
    r.lang = 'ar-EG'
    r.interimResults = false
    r.onresult = (e) => void send(e.results[0]?.[0]?.transcript ?? '')
    r.onend = () => setListening(false)
    r.onerror = () => {
      setListening(false)
      say('bot', 'ما قدرناش نسمعك. اتأكد إن الميكروفون شغّال، أو اكتب.')
    }
    rec.current = r
    setListening(true)
    r.start()
  }

  return (
    <Dialog title="المساعد" subtitle="اتكلم أو اكتب" onClose={onClose}>
      <div className="agent-log" aria-live="polite">
        {lines.length === 0 && (
          <div className="voice-examples">
            <span className="muted small">جرّب:</span>
            {EXAMPLES.map((x) => (
              <button key={x} type="button" className="chip chip-neutral" onClick={() => void send(x)}>
                {x}
              </button>
            ))}
          </div>
        )}
        {lines.map((l, i) => (
          <p key={i} className={`agent-msg agent-${l.who}`}>
            {l.text}
          </p>
        ))}
        {busy && !ask && <p className="agent-msg agent-bot muted">بفكّر...</p>}
        {ask && (
          <div className="voice-pick">
            <p style={{ whiteSpace: 'pre-line' }}>{ask.text}</p>
            <div className="voice-row">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  ask.resolve(true)
                  setAsk(null)
                }}
              >
                أيوه، نفّذ
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  ask.resolve(false)
                  setAsk(null)
                }}
              >
                لأ
              </button>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="voice-form"
        onSubmit={(e) => {
          e.preventDefault()
          void send(text)
        }}
      >
        <div className="voice-row">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="قولّي عايز إيه..."
            aria-label="الأمر"
            autoFocus
          />
          {canSpeak && (
            <button
              type="button"
              className={`btn btn-icon voice-mic${listening ? ' is-on' : ''}`}
              onClick={listen}
              aria-label={listening ? 'إيقاف التسجيل' : 'اتكلم'}
            >
              {listening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          )}
          <button className="btn btn-icon" disabled={!text.trim() || busy} aria-label="إرسال">
            <Send size={18} />
          </button>
        </div>
      </form>
      {!canSpeak && <p className="muted small">المتصفح ده مش بيدعم الصوت. افتح المصباح من كروم، أو اكتب.</p>}
    </Dialog>
  )
}
