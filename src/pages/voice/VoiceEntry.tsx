import { useState } from 'react'
import { Mic, Square } from 'lucide-react'
import PageHead from '../../components/PageHead'
import { todayISO } from '../../lib/core/format'
import { useAsync } from '../../lib/core/useAsync'
import { useSubmitGuard } from '../../lib/core/useSubmitGuard'
import { askVoice, fetchVoiceData, saveDraft, type VoiceData } from '../../lib/voice/data'
import { toDrafts, toHeard, type Draft } from '../../lib/voice/drafts'
import { useRecorder } from '../../lib/voice/useRecorder'
import DraftCard from './DraftCard'
import { useDuplicates } from './useDuplicates'

/** Admin only: say the entries, check the cards, save. Nothing is saved by itself. */
export default function VoiceEntry() {
  const data = useAsync<VoiceData>(fetchVoiceData)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [demo, setDemo] = useState(false)
  const [reply, setReply] = useState('')
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
    const today = todayISO()
    const r = await askVoice(audio, data.data, drafts.map(toHeard), today)
    setThinking(false)
    if (!r.answer) return setError(r.error)
    setDemo(r.answer.demo)
    setReply(r.answer.reply)
    setErrors({})
    setDrafts(toDrafts(r.answer.drafts, r.answer.demo ? null : data.data, drafts, today))
  }

  const recorder = useRecorder((wav) => void understand(wav), setError)
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
  const frozen = recorder.recording || thinking || saving !== null

  return (
    <div className="page-stack quick-page">
      <PageHead title="التسجيل بالصوت" note="قول القيود، راجعها، واحفظ. للتصحيح سجّل تاني: «لأ، المبلغ ٦٠٠٠»." />
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
          disabled={!data.data || thinking || saving !== null}
        >
          {recorder.recording ? <Square size={20} aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}
          {recorder.recording ? `إيقاف (${recorder.seconds} ث)` : thinking ? 'بفهم كلامك...' : 'سجّل'}
        </button>
      </div>
      {data.failed && <p className="msg msg-error">مقدرناش نحمّل القوايم، جرّب تاني</p>}
      {error && <p className="msg msg-error">{error}</p>}
      {reply && (
        <p className="msg" role="status">
          {reply}
        </p>
      )}
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
