import { useEffect, useMemo, useRef, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import Dialog from './Dialog'
import EntryDialog from './EntryDialog'
import { fetchCategories } from '../lib/catalog'
import { money } from '../lib/format'
import { fetchSummaries, type ProjectSummary } from '../lib/projects'
import { supabase } from '../lib/supabase'
import { parseCommand, type Command } from '../lib/voiceCommand'
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

const EXAMPLES = ['سجّل ٥٠٠ نقاشة على الجندي', 'كام صرفنا على العيادة؟', 'افتح الموافقات', 'افتح مشروع العيادة', 'اقفل']

function answer(c: Extract<Command, { intent: 'query' }>, all: ProjectSummary[]): string {
  const rows = c.project ? all.filter((p) => p.id === c.project?.id) : all.filter((p) => p.status === 'active')
  const income = rows.reduce((t, p) => t + p.income, 0)
  const expenses = rows.reduce((t, p) => t + p.expenses, 0)
  const who = c.project ? `مشروع ${c.project.name}` : 'كل المشاريع النشطة'
  const parts = {
    income: `الوارد ${money(income)} ج.م`,
    expenses: `المصروف ${money(expenses)} ج.م`,
    balance: `الرصيد ${money(income - expenses)} ج.م`,
  }
  if (c.metric === 'all') return `${who}: ${parts.income} · ${parts.expenses} · ${parts.balance}`
  return `${who}: ${parts[c.metric]}`
}

/** Talk or type a short command: ask about a project, or start an entry that you still check and save yourself. */
export default function VoiceAssistant({ onClose }: { onClose: () => void }) {
  const { isAdmin, isOwner, can } = useAuth()
  const projects = useAsync<ProjectSummary[]>(fetchSummaries)
  const cats = useAsync(fetchCategories)
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [reply, setReply] = useState<string | null>(null)
  const [draft, setDraft] = useState<Extract<Command, { intent: 'entry' }> | null>(null)
  const [pickId, setPickId] = useState('')
  const [busy, setBusy] = useState(false)
  const rec = useRef<Recognition | null>(null)
  const canSpeak = useMemo(() => speech() !== null, [])
  const mayEnter = isAdmin || isOwner || can('projects', 'edit')
  const all = useMemo(() => projects.data ?? [], [projects.data])
  const active = all.filter((p) => p.status === 'active')

  useEffect(() => () => rec.current?.stop(), [])

  /** Ask the AI first; if it is unreachable or unsure, fall back to the fixed rules. */
  async function understand(input: string): Promise<Command> {
    const names = (cats.data ?? []).map((c) => c.name)
    const fixed = parseCommand(input, all, names)
    if (fixed.intent === 'open' || fixed.intent === 'close') return fixed
    try {
      const { data, error } = await supabase.functions.invoke('assistant', {
        body: { text: input, projects: all.map((p) => ({ id: p.id, name: p.name })), categories: names },
      })
      if (!error && data && (data.intent === 'entry' || data.intent === 'query')) {
        const project = all.find((p) => p.id === data.project_id)
        const named = project ? { id: project.id, name: project.name } : null
        if (data.intent === 'query') {
          return { intent: 'query', metric: data.metric ?? 'all', project: named }
        }
        return {
          intent: 'entry',
          kind: data.kind === 'income' ? 'income' : 'expense',
          amount: Number(data.amount) > 0 ? Number(data.amount) : null,
          project: named,
          text: String(data.text ?? ''),
          category: names.includes(data.category) ? data.category : '',
        }
      }
    } catch {
      /* fall through to the rules */
    }
    return parseCommand(input, all, names)
  }

  async function run(input: string) {
    setReply(null)
    setDraft(null)
    setBusy(true)
    const cmd = await understand(input)
    setBusy(false)
    if (cmd.intent === 'close') return onClose()
    if (cmd.intent === 'open') {
      window.location.hash = `#/${cmd.path}`
      return onClose()
    }
    if (cmd.intent === 'unknown') return setReply('ما فهمتش. جرّب جملة زي اللي تحت.')
    if (cmd.intent === 'query') return setReply(answer(cmd, all))
    if (!mayEnter) return setReply('مش عندك صلاحية تسجيل قيود.')
    if (!cmd.amount) return setReply('ما سمعتش المبلغ. قول مثلًا: سجّل ٥٠٠ نقاشة على الجندي.')
    setPickId(cmd.project?.id ?? '')
    setDraft(cmd)
  }

  function listen() {
    const Ctor = speech()
    if (!Ctor) return
    if (listening) return rec.current?.stop()
    const r = new Ctor()
    r.lang = 'ar-EG'
    r.interimResults = false
    r.onresult = (e) => {
      const heard = e.results[0]?.[0]?.transcript ?? ''
      setText(heard)
      run(heard)
    }
    r.onend = () => setListening(false)
    r.onerror = () => {
      setListening(false)
      setReply('ما قدرناش نسمعك. اتأكد إن الميكروفون شغّال، أو اكتب الجملة.')
    }
    rec.current = r
    setListening(true)
    r.start()
  }

  const chosen = active.find((p) => p.id === pickId)

  if (draft && chosen) {
    return (
      <EntryDialog
        projectId={chosen.id}
        projectName={chosen.name}
        prefill={{ kind: draft.kind, amount: draft.amount, category: draft.category, text: draft.text }}
        onClose={onClose}
        onSaved={onClose}
      />
    )
  }

  return (
    <Dialog title="المساعد" subtitle="اتكلم أو اكتب" onClose={onClose}>
      <form
        className="voice-form"
        onSubmit={(e) => {
          e.preventDefault()
          run(text)
        }}
      >
        <div className="voice-row">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="مثلًا: سجّل ٥٠٠ نقاشة على الجندي"
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
              {listening ? 'بسمعك...' : 'اتكلم'}
            </button>
          )}
          <button className="btn" disabled={!text.trim() || !projects.data || busy}>
            {busy ? 'بفكّر...' : 'نفّذ'}
          </button>
        </div>
      </form>

      {!canSpeak && <p className="muted small">المتصفح ده مش بيدعم الصوت. افتح المصباح من كروم، أو اكتب الأمر.</p>}
      {projects.failed && <p className="msg msg-error">مقدرناش نحمّل المشاريع، جرّب تاني</p>}
      {reply && <p className="voice-reply">{reply}</p>}

      {draft && !chosen && (
        <div className="voice-pick">
          <p>
            فهمت: {draft.kind === 'income' ? 'وارد' : 'مصروف'} {money(draft.amount ?? 0)} ج.م
            {draft.text ? ` — ${draft.text}` : ''}. على أنهي مشروع؟
          </p>
          <select value={pickId} onChange={(e) => setPickId(e.target.value)} aria-label="المشروع">
            <option value="">اختار المشروع</option>
            {active.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="voice-examples">
        <span className="muted small">أمثلة:</span>
        {EXAMPLES.map((x) => (
          <button
            key={x}
            type="button"
            className="chip chip-neutral"
            onClick={() => {
              setText(x)
              run(x)
            }}
          >
            {x}
          </button>
        ))}
      </div>
    </Dialog>
  )
}
