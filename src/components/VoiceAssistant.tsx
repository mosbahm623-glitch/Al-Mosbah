import { useEffect, useMemo, useRef, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import Dialog from './Dialog'
import EntryDialog from './EntryDialog'
import { decide, fetchByStatus, type PendingEntry } from '../lib/approvals'
import { fetchCategories } from '../lib/catalog'
import { fetchContractorLedger } from '../lib/contractors'
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

const EXAMPLES = [
  'سجّل ٥٠٠ نقاشة على الجندي',
  'كام صرفنا على العيادة؟',
  'افتح الموافقات',
  'افتح مشروع العيادة',
  'وافق على كل القيود',
  'اقفل',
]

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
  const people = useAsync(() =>
    supabase.from('contractors').select('id,name').order('name').returns<{ id: string; name: string }[]>(),
  )
  const [link, setLink] = useState<{ label: string; path: string } | null>(null)
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [reply, setReply] = useState<string | null>(null)
  const [draft, setDraft] = useState<Extract<Command, { intent: 'entry' }> | null>(null)
  const [pickId, setPickId] = useState('')
  const [busy, setBusy] = useState(false)
  const [toApprove, setToApprove] = useState<{ rows: PendingEntry[]; who: string } | null>(null)
  const rec = useRef<Recognition | null>(null)
  const canSpeak = useMemo(() => speech() !== null, [])
  const mayEnter = isAdmin || isOwner || can('projects', 'edit')
  const all = useMemo(() => projects.data ?? [], [projects.data])
  const active = all.filter((p) => p.status === 'active')

  useEffect(() => () => rec.current?.stop(), [])

  /** Ask the AI first; if it is unreachable or unsure, fall back to the fixed rules. */
  async function understand(input: string): Promise<Command> {
    const names = (cats.data ?? []).map((c) => c.name)
    const fixed = parseCommand(input, all, names, people.data ?? [])
    if (['open', 'close', 'approve', 'lookup'].includes(fixed.intent)) return fixed
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
    setLink(null)
    setBusy(true)
    const cmd = await understand(input)
    setBusy(false)
    if (cmd.intent === 'close') return onClose()
    if (cmd.intent === 'open') {
      window.location.hash = `#/${cmd.path}`
      return onClose()
    }
    if (cmd.intent === 'lookup') {
      if (!cmd.contractor) {
        window.location.hash = `#/search?q=${encodeURIComponent(cmd.category)}`
        return onClose()
      }
      setBusy(true)
      const led = await fetchContractorLedger(cmd.contractor.id)
      setBusy(false)
      if (!led) return setReply('مقدرناش نحمّل حساب المقاول، جرّب تاني.')
      const pid = cmd.project?.id
      const pname = cmd.project?.name
      const txns = led.txns.filter((t) => !pid || t.project_id === pid)
      const spent = led.spent.filter(
        (e) => (!pname || e.project?.name === pname) && (!cmd.category || e.category === cmd.category),
      )
      const sum = (xs: number[]) => xs.reduce((t, n) => t + n, 0)
      const due = sum(txns.filter((t) => t.kind === 'due').map((t) => t.amount))
      const paid = sum(txns.filter((t) => t.kind === 'payment').map((t) => t.amount))
      const where = [pname && `مشروع ${pname}`, cmd.category && `بند ${cmd.category}`].filter(Boolean).join(' · ')
      setLink({ label: `افتح صفحة ${cmd.contractor.name}`, path: `contractors/${cmd.contractor.id}` })
      return setReply(
        `${cmd.contractor.name}${where ? ` (${where})` : ''}\nمستحقات ${money(due)} · مدفوع ${money(paid)} · الباقي ${money(due - paid)} ج.م\nمصروفات معتمدة باسمه: ${money(sum(spent.map((e) => e.amount)))} ج.م (${spent.length} قيد)`,
      )
    }
    if (cmd.intent === 'approve') {
      if (!isAdmin) return setReply('الموافقة للأدمن بس.')
      const { data } = await fetchByStatus('pending')
      const rows = (data ?? []).filter((e) => !cmd.project || e.project_id === cmd.project.id)
      if (!rows.length) return setReply('مفيش قيود مستنية موافقة.')
      return setToApprove({ rows, who: cmd.project ? `مشروع ${cmd.project.name}` : 'كل المشاريع' })
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

  async function approveAll() {
    if (!toApprove) return
    setBusy(true)
    const r = await decide(
      toApprove.rows.map((e) => ({ id: e.id, rev: e.rev })),
      'approved',
    )
    setBusy(false)
    setToApprove(null)
    setReply(
      r.failed
        ? 'حصلت مشكلة، راجع صفحة الموافقات.'
        : `اتوافق على ${r.done} قيد${r.skipped ? ` (${r.skipped} اتغيّروا ومحتاجين مراجعة)` : ''}.`,
    )
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
      {reply && (
        <p className="voice-reply" style={{ whiteSpace: 'pre-line' }}>
          {reply}
        </p>
      )}
      {link && (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            window.location.hash = `#/${link.path}`
            onClose()
          }}
        >
          {link.label}
        </button>
      )}

      {toApprove && (
        <div className="voice-pick">
          <p>
            {toApprove.who}: {toApprove.rows.length} قيد بإجمالي{' '}
            {money(toApprove.rows.reduce((t, e) => t + e.amount, 0))} ج.م. أوافق عليهم كلهم؟
          </p>
          <div className="voice-row">
            <button type="button" className="btn" disabled={busy} onClick={approveAll}>
              أيوه، وافق
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setToApprove(null)}>
              لأ
            </button>
          </div>
        </div>
      )}

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
