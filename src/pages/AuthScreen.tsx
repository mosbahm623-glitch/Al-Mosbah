import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'

export default function AuthScreen() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await signIn(email, password)
    setBusy(false)
    if (err) setError(err)
  }

  return (
    <main className="center">
      <form className="card auth" onSubmit={onSubmit}>
        <h1>المصباح</h1>
        <p className="muted">تسجيل الدخول</p>

        <label>
          الإيميل
          <input
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label>
          كلمة السر
          <input
            type="password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && <p className="msg msg-error">{error}</p>}

        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'لحظة...' : 'دخول'}
        </button>
      </form>
    </main>
  )
}
