import { useState, type FormEvent } from 'react'
import Dialog from '../../components/Dialog'
import { createUser } from '../../lib/users'

export default function NewUserDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const err = await createUser({ full_name: name, email, password })
    setSaving(false)
    if (err) return setError(err)
    onCreated()
    onClose()
  }

  return (
    <Dialog title="مستخدم جديد" subtitle="بعد الإنشاء حدد صلاحياته" onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="dialog-form">
        <label className="field">
          الاسم
          <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </label>
        <label className="field">
          الإيميل
          <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          كلمة السر (8 حروف على الأقل)
          <input type="text" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoComplete="off" />
        </label>
        {error && <p className="msg msg-error">{error}</p>}
        <div className="dialog-actions">
          <button className="btn" disabled={saving}>
            {saving ? 'جارٍ الإنشاء...' : 'إنشاء'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </form>
    </Dialog>
  )
}
