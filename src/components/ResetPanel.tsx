import { useState, type FormEvent } from 'react'
import { RotateCcw } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { ALL_DATA_GROUPS, RESET_GROUPS, RESET_WORD, resetData, withRequired, type ResetGroupId } from '../lib/reset'
import Dialog from './Dialog'

/** Admin only. Wipes the data groups the admin ticks (users included, if he wants); asks to type a word first. */
export default function ResetPanel() {
  const { isAdmin } = useAuth()
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<Set<ResetGroupId>>(new Set())
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  if (!isAdmin) return null

  const chosen = withRequired(picked)
  // a group another ticked group needs stays ticked until that one is unticked
  const neededBy = (id: ResetGroupId) =>
    RESET_GROUPS.find((g) => g.id !== id && picked.has(g.id) && g.requires.includes(id))
  const ready = chosen.size > 0 && typed.trim() === RESET_WORD

  function close() {
    setOpen(false)
    setPicked(new Set())
    setTyped('')
    setError(null)
  }

  function toggle(id: ResetGroupId) {
    if (neededBy(id)) return
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!ready) return
    setBusy(true)
    setError(null)
    const res = await resetData([...picked])
    setBusy(false)
    if (res.error) return setError(res.error)
    close()
    setDone(
      res.photosLeft
        ? 'اتعملت إعادة الضبط. بعض صور الفواتير ما اتمسحتش من التخزين، بس مبقتش ظاهرة في التطبيق.'
        : 'اتعملت إعادة الضبط، واللي اخترته اتمسح.',
    )
  }

  return (
    <section className="panel backup reset">
      <div className="panel-head">
        <h2>إعادة ضبط التطبيق</h2>
      </div>
      <p className="muted small">
        اختار اللي عايز تمسحه وابدأ من الأول. نزّل نسخة احتياطية قبلها لو محتاج تحتفظ بحاجة.
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
        <Dialog title="إعادة ضبط التطبيق" subtitle="اختار اللي يتمسح" onClose={close}>
          <form onSubmit={(e) => void submit(e)} className="dialog-form">
            <div className="reset-list" role="group" aria-label="اللي هيتمسح">
              {RESET_GROUPS.map((g) => {
                const by = neededBy(g.id)
                return (
                  <label key={g.id} className="check reset-opt">
                    <input
                      type="checkbox"
                      checked={chosen.has(g.id)}
                      disabled={busy || Boolean(by)}
                      onChange={() => toggle(g.id)}
                    />
                    <span>
                      <b>{g.label}</b>
                      <small className="muted">{by ? `لازم يتمسح مع «${by.label}»` : g.hint}</small>
                    </span>
                  </label>
                )
              })}
            </div>
            <div className="dialog-actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => setPicked(new Set(ALL_DATA_GROUPS))}
              >
                كل البيانات (من غير المستخدمين)
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy || picked.size === 0}
                onClick={() => setPicked(new Set())}
              >
                إلغاء الاختيار
              </button>
            </div>
            {chosen.has('users') && (
              <p className="msg msg-error">المستخدمين هيتمسحوا كلهم ماعدا حسابك، ومش هيعرفوا يدخلوا تاني.</p>
            )}
            <p className="muted small">
              اللي ما اخترتوش بيفضل زي ما هو. <b>مفيش رجوع من المسح.</b>
            </p>
            <label className="field">
              اكتب كلمة «{RESET_WORD}» للتأكيد
              <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" disabled={busy} />
            </label>
            {error && <p className="msg msg-error">{error}</p>}
            <div className="dialog-actions">
              <button className="btn btn-danger" disabled={busy || !ready}>
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
