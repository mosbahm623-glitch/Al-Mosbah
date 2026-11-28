import { useRef, useState } from 'react'
import { Mic, Phone, PhoneOff, Square } from 'lucide-react'
import PageHead from '../../components/PageHead'
import { todayISO } from '../../lib/core/format'
import { useAsync } from '../../lib/core/useAsync'
import { useSubmitGuard } from '../../lib/core/useSubmitGuard'
import { askVoice, fetchVoiceData, saveDraft, type VoiceData } from '../../lib/voice/data'
import { toDrafts, toHeard, type Draft } from '../../lib/voice/drafts'
import { toReport, type VoiceReport } from '../../lib/voice/report'
import { useLive } from '../../lib/voice/useLive'
import { useRecorder } from '../../lib/voice/useRecorder'
import DraftCard from './DraftCard'
import ReportOffer from './ReportOffer'
import { useDuplicates } from './useDuplicates'

/** Admin only: say the entries, check the cards, save. Nothing is saved by itself. */
export default function VoiceEntry() {
  const data = useAsync<VoiceData>(fetchVoiceData)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [demo, setDemo] = useState(false)
  const [reply, setReply] = useState('')
  const [report, setReport] = useState<VoiceReport | null>(null)
  const [done, setDone] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [thinking, setThinking] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const guard = useSubmitGuard()
  const duplicate = useDuplicates(drafts, demo ? null : data.data)

  async function understand(audio: string) {
    if (!data.data) return
    setThinking(true)
    setError(null)
    setReport(null)
    const today = todayISO()
    const r = await askVoice(audio, data.data, drafts.map(toHeard), today)
    setThinking(false)
    if (!r.answer) return setError(r.error)
    setDemo(r.answer.demo)
    setReply(r.answer.reply)
    setErrors({})
    const asked = r.answer.report?.kind ? r.answer.report : null
    if (asked) setReport(toReport(asked, data.data))
    // asking for a report must never wipe the cards
    if (asked && r.answer.drafts.length === 0) return
    setDrafts(toDrafts(r.answer.drafts, r.answer.demo ? null : data.data, drafts, today))
  }

  const recorder = useRecorder((wav) => void understand(wav), setError)
  // the model sends the call's whole list each time; cards that were there before the call stay as they are
  const beforeCall = useRef<Draft[]>([])
  const offer = (asked: Parameters<typeof toReport>[0], trial: boolean) => {
    if (data.data && !trial) setReport(toReport(asked, data.data))
  }
  const call = useLive(
    (heard, said, trial) => {
      if (!data.data) return
      const added = toDrafts(heard, trial ? null : data.data, [], todayISO())
      setDemo(trial)
      setReply(said)
      setErrors({})
      setDrafts([...(trial ? [] : beforeCall.current), ...added])
    },
    offer,
    setError,
  )
  const calling = call.state !== 'off'
  const remove = (id: string) => setDrafts((list) => list.filter((d) => d.id !== id))

  async function save(draft: Draft) {
    if (!data.data) return
    setSaving(draft.id)
    const r = await saveDraft(draft, data.data)
    setSaving(null)
    if (r.error !== null) return setErrors((e) => ({ ...e, [draft.id]: r.error }))
    setDone((list) => [...list, r.note])
    remove(draft.id)
  }

  // the cards are frozen while a recording is being made or understood, so a spoken correction can't undo typing
  const frozen = calling || recorder.recording || thinking || saving !== null

  return (
    <div className="page-stack quick-page">
      <PageHead title="التسجيل بالصوت" note="قول القيود، راجعها، واحفظ. أو اطلب تقرير: «كشف حساب بنك كذا»." />
      {demo && (
        <p className="msg msg-error" role="status">
          وضع تجربة: الأسماء وهمية ومفيش حفظ. متقولش بيانات حقيقية.
        </p>
      )}
      <div className="voice-mic">
        <button
          type="button"
          className={recorder.recording ? 'btn btn-danger' : 'btn'}
          onClick={() => (recorder.recording ? recorder.stop() : void recorder.start())}
          disabled={!data.data || thinking || calling || saving !== null}
        >
          {recorder.recording ? <Square size={20} aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}
          {recorder.recording ? `إيقاف (${recorder.seconds} ث)` : thinking ? 'بفهم كلامك...' : 'سجّل'}
        </button>
        <button
          type="button"
          className={calling ? 'btn btn-danger' : 'btn'}
          onClick={() => {
            if (calling) return call.stop()
            if (!data.data) return
            setError(null)
            setReply('')
            setReport(null)
            beforeCall.current = drafts
            void call.start(todayISO(), data.data)
          }}
          disabled={!data.data || recorder.recording || thinking || saving !== null}
        >
          {calling ? <PhoneOff size={20} aria-hidden="true" /> : <Phone size={20} aria-hidden="true" />}
          {call.state === 'connecting' ? 'بيتصل...' : calling ? 'إنهاء المكالمة' : 'مكالمة لحظية'}
        </button>
      </div>
      {call.state === 'on' && (
        <p className="msg" role="status">
          سامعك، اتكلم. وبعد ما تخلص اقفل المكالمة وراجع الكروت.{call.heard && ` «${call.heard}»`}
        </p>
      )}
      {data.failed && <p className="msg msg-error">مقدرناش نحمّل القوايم، جرّب تاني</p>}
      {error && <p className="msg msg-error">{error}</p>}
      {reply && (
        <p className="msg" role="status">
          {reply}
        </p>
      )}
      {report && <ReportOffer report={report} onOpen={call.stop} />}
      {done.map((note, i) => (
        <p className="msg msg-ok" key={i}>
          {note}
        </p>
      ))}
      {drafts.map((d) => (
        <DraftCard
          key={d.id}
          draft={d}
          data={demo ? null : data.data}
          busy={frozen}
          error={errors[d.id]}
          duplicate={duplicate(d)}
          onChange={(patch) => setDrafts((list) => list.map((x) => (x.id === d.id ? { ...x, ...patch } : x)))}
          onSave={() => void guard(() => save(d))}
          onRemove={() => remove(d.id)}
        />
      ))}
    </div>
  )
}
