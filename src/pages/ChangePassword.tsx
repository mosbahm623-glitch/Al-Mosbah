import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'

/** First login with the temporary password the admin set: the user chooses his own before using the app. */
export default function ChangePassword() {
  const { profile, setOwnPassword, signOut } = useAuth()
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setError('كلمة السر لازم 8 حروف على الأقل')
    if (password !== again) return setError('كلمتين السر مش زي بعض')
    setBusy(true)
    setError(null)
    const err = await setOwnPassword(password)
    setBusy(false)
    if (err) setError(err)
  }

  return (
    <main className="center">
      <form className="card auth" onSubmit={(e) => void submit(e)}>
        <h1>المصباح</h1>
        <p>{profile?.full_name ? `أهلاً ${profile.full_name}` : 'أهلاً بيك'}</p>
        <p className="muted">كلمة السر اللي معاك مؤقتة. اعمل كلمة سر خاصة بيك عشان تكمّل.</p>
        <label className="field">
          كلمة السر الجديدة (8 حروف على الأقل)
          <input
            type="password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
            autoFocus
          />
        </label>
        <label className="field">
          أعد كتابتها
          <input
            type="password"
            dir="ltr"
            value={again}
            onChange={(e) => setAgain(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        {error && (
          <p className="msg msg-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn" disabled={busy}>
          {busy ? 'جارٍ الحفظ...' : 'حفظ ومتابعة'}
        </button>
        <button type="button" className="btn btn-link" onClick={() => void signOut()}>
          تسجيل الخروج
        </button>
      </form>
    </main>
  )
}
