import { useState, type FormEvent } from 'react'
import { RotateCcw } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { RESET_WORD, resetAllData } from '../lib/reset'
import Dialog from './Dialog'

/** Admin only. Wipes all the operating data (users and permissions stay); asks to type a word first. */
export default function ResetPanel() {
  const { isAdmin } = useAuth()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  if (!isAdmin) return null

  function close() {
    setOpen(false)
    setTyped('')
    setError(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (typed.trim() !== RESET_WORD) return
    setBusy(true)
    setError(null)
    const res = await resetAllData()
    setBusy(false)
    if (res.error) return setError(res.error)
    close()
    setDone(
      res.photosLeft
        ? 'اتعملت إعادة الضبط. بعض صور الفواتير ما اتمسحتش من التخزين، بس مبقتش ظاهرة في التطبيق.'
        : 'اتعملت إعادة الضبط، والبيانات اتمسحت.',
    )
  }

  return (
    <section className="panel backup reset">
      <div className="panel-head">
        <h2>إعادة ضبط التطبيق</h2>
      </div>
      <p className="muted small">
        بتمسح كل البيانات وتبدأ من الأول. المستخدمين وصلاحياتهم بيفضلوا زي ما هما. نزّل نسخة احتياطية قبلها لو محتاج
        تحتفظ بحاجة.
      </p>
      {done && <p className="msg msg-ok">{done}</p>}
      <button
        className="btn btn-danger btn-icon"
        onClick={() => {
          setDone(null)
          setOpen(true)
        }}
      >
        <RotateCcw size={18} aria-hidden="true" />
        إعادة ضبط
      </button>
      {open && (
        <Dialog title="إعادة ضبط التطبيق" onClose={close}>
          <form onSubmit={(e) => void submit(e)} className="dialog-form">
            <p>
              هيتمسح كل حاجة: القيود والمشاريع والعهد والبنوك والمقاولين والبنود والإشعارات، وترقيم القيود هيبدأ من
              الأول. المستخدمين وصلاحياتهم هيفضلوا. <b>مفيش رجوع من ده.</b>
            </p>
            <label className="field">
              اكتب كلمة «{RESET_WORD}» للتأكيد
              <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus />
            </label>
            {error && <p className="msg msg-error">{error}</p>}
            <div className="dialog-actions">
              <button className="btn btn-danger" disabled={busy || typed.trim() !== RESET_WORD}>
                {busy ? 'جارٍ المسح...' : 'إعادة ضبط نهائية'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={close} disabled={busy}>
                إلغاء
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </section>
  )
}
