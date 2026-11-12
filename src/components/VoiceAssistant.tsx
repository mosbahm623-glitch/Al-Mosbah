import { useEffect, useMemo, useRef, useState } from 'react'
import { Mic, MicOff, Send } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import Dialog from './Dialog'
import { askAgent, describeWrite, loadContext, runTool, WRITE_TOOLS, type Content, type ToolCall } from '../lib/agent'
import { advanceBalance, fetchAdvanceSummaries } from '../lib/advances'
import { bankBalance, fetchBankSummaries } from '../lib/banks'
import { fetchCategories } from '../lib/catalog'
import { money } from '../lib/format'
import { fetchContractorNames } from '../lib/lookups'
import { fetchSummaries, type ProjectSummary } from '../lib/projects'
import { parseCommand } from '../lib/voiceCommand'
import { useAsync } from '../lib/useAsync'

type Recognition = {
  lang: string
  interimResults: boolean
  maxAlternatives?: number
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error?: string }) => void) | null
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
  const people = useAsync(fetchContractorNames)
  const banks = useAsync(fetchBankSummaries)
  const advs = useAsync(fetchAdvanceSummaries)
  const cats = useAsync(fetchCategories)
  const [text, setText] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [ask, setAsk] = useState<Ask | null>(null)
  const rec = useRef<Recognition | null>(null)
  const history = useRef<Content[]>([])
  const failedRef = useRef(false)
  const context = useRef<Promise<string> | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const canSpeak = useMemo(() => speech() !== null, [])
  const mayEnter = isAdmin || isOwner || can('projects', 'edit')
  const tools = { isAdmin, mayEnter, today: todayText(), go }
  const names = useMemo(() => new Map((projects.data ?? []).map((p) => [p.id, p.name])), [projects.data])

  useEffect(() => {
    context.current = loadContext().catch(() => '')
    return () => rec.current?.stop()
  }, [])
  useEffect(() => endRef.current?.scrollIntoView({ block: 'end' }), [lines, ask])

  const say = (who: Line['who'], t: string) => setLines((l) => [...l, { who, text: t }])
  const go = (path: string) => {
    window.location.hash = `#/${path}`
    onClose()
  }

  function confirm(t: string) {
    return new Promise<boolean>((resolve) => setAsk({ text: t, resolve }))
  }

  /** Answers what the fixed rules understand right away. Returns false when the AI should take over. */
  async function quick(q: string): Promise<boolean> {
    const all = projects.data ?? []
    const cmd = parseCommand(
      q,
      all,
      (cats.data ?? []).map((c) => c.name),
      people.data ?? [],
      (banks.data ?? []).map((b) => ({ id: b.id, name: b.name })),
      (advs.data ?? []).map((a) => ({ id: a.id, name: a.holder_name })),
    )
    if (cmd.intent === 'close') return (onClose(), true)
    if (cmd.intent === 'open') return (go(cmd.path), true)
    if (cmd.intent === 'pending') {
      const r = await runTool({ name: 'pending_entries', args: {} }, tools)
      say(
        'bot',
        r.count
          ? `فيه ${r.count} قيد مستنيين موافقة بإجمالي ${money(Number(r.total))} ج.م.`
          : 'مفيش حاجة مستنية موافقة.',
      )
      return true
    }
    if (cmd.intent === 'query') {
      const rows = cmd.project ? all.filter((p) => p.id === cmd.project?.id) : all.filter((p) => p.status === 'active')
      const income = rows.reduce((t, p) => t + p.income, 0)
      const expenses = rows.reduce((t, p) => t + p.expenses, 0)
      const parts = {
        income: `الوارد ${money(income)}`,
        expenses: `المصروف ${money(expenses)}`,
        balance: `الرصيد ${money(income - expenses)}`,
      }
      const body = cmd.metric === 'all' ? Object.values(parts).join(' · ') : parts[cmd.metric]
      say('bot', `${cmd.project ? `مشروع ${cmd.project.name}` : 'كل المشاريع النشطة'}: ${body} ج.م`)
      return true
    }
    if (cmd.intent === 'account') {
      if (cmd.kind === 'bank') {
        const b = (banks.data ?? []).find((x) => x.id === cmd.item.id)
        if (!b) return false
        say(
          'bot',
          `${b.name}: الرصيد ${money(bankBalance(b))} · وارد ${money(b.income)} · مصروف ${money(b.expenses)} ج.م`,
        )
        return true
      }
      const a = (advs.data ?? []).find((x) => x.id === cmd.item.id)
      if (!a) return false
      say(
        'bot',
        `عهدة ${a.holder_name}: استلم ${money(a.given)} · صرف ${money(a.spent)} · رجّع ${money(a.returned)} · الباقي ${money(advanceBalance(a))} ج.م`,
      )
      return true
    }
    if (cmd.intent === 'lookup') {
      if (!cmd.contractor) return (go(`search?q=${encodeURIComponent(cmd.category)}`), true)
      setBusy(true)
      const r = await runTool(
        { name: 'contractor_account', args: { contractor_id: cmd.contractor.id, project_id: cmd.project?.id ?? '' } },
        tools,
      )
      setBusy(false)
      if (r.error) return false
      const where = cmd.project ? ` في ${cmd.project.name}` : ''
      say(
        'bot',
        `${cmd.contractor.name}${where}: مستحقات ${money(Number(r.due))} · مدفوع ${money(Number(r.paid))} · الباقي ${money(Number(r.remaining))} ج.م`,
      )
      return true
    }
    return false
  }

  async function send(input: string) {
    const q = input.trim()
    if (!q || busy) return
    setText('')
    say('me', q)

    // the plain ones are answered on the spot, with no AI and no waiting
    if (await quick(q)) return

    setBusy(true)
    history.current.push({ role: 'user', parts: [{ text: q }] })
    try {
      for (let step = 0; step < MAX_STEPS; step++) {
        const { data, error } = await askAgent(history.current, todayText(), (await context.current) ?? '')
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
            result = await runTool(call, tools)
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
    r.interimResults = true
    r.maxAlternatives = 1
    // phones often end the session without a "final" answer, so keep what was heard so far and use it at the end
    let heard = ''
    r.onresult = (e) => {
      heard = Array.from(e.results as ArrayLike<ArrayLike<{ transcript: string }>>)
        .map((x) => x[0]?.transcript ?? '')
        .join(' ')
        .trim()
      setText(heard)
    }
    r.onend = () => {
      setListening(false)
      if (heard) void send(heard)
      else if (!failedRef.current) say('bot', 'ما سمعتش حاجة. دوس على الميكروفون وابدأ كلام على طول.')
      failedRef.current = false
    }
    r.onerror = (e) => {
      failedRef.current = true
      setListening(false)
      const why: Record<string, string> = {
        'not-allowed': 'المتصفح مانع الميكروفون. دوس على القفل جنب العنوان فوق وسمح للميكروفون، وبعدين جرّب.',
        'service-not-allowed': 'المتصفح مانع الميكروفون. دوس على القفل جنب العنوان فوق وسمح للميكروفون، وبعدين جرّب.',
        'audio-capture': 'مفيش ميكروفون شغّال على الجهاز.',
        network: 'الصوت محتاج نت. اتأكد من الاتصال وجرّب تاني.',
        'no-speech': 'ما سمعتش حاجة. قول الجملة بعد ما تدوس.',
      }
      say('bot', why[e.error ?? ''] ?? 'ما قدرناش نسمعك. اكتب الجملة.')
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
            placeholder={listening ? 'بسمعك... اتكلم دلوقتي' : 'قولّي عايز إيه...'}
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
