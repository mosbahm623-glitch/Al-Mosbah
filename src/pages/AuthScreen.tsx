import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'

export default function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    const err = mode === 'in' ? await signIn(email, password) : await signUp(email, password, fullName)
    setBusy(false)
    if (err) {
      setError(err)
    } else if (mode === 'up') {
      setInfo('تم إنشاء الحساب. لو وصلتك رسالة تأكيد على الإيميل افتحها، وبعدها الأدمن هيفعّل حسابك.')
    }
  }

  return (
    <main className="center">
      <form className="card auth" onSubmit={onSubmit}>
        <h1>المصباح</h1>
        <p className="muted">{mode === 'in' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}</p>

        {mode === 'up' && (
          <label>
            الاسم
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
          </label>
        )}
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
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            minLength={6}
            required
          />
        </label>

        {error && <p className="msg msg-error">{error}</p>}
        {info && <p className="msg msg-ok">{info}</p>}

        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'لحظة...' : mode === 'in' ? 'دخول' : 'إنشاء الحساب'}
        </button>
        <button
          className="btn btn-link"
          type="button"
          onClick={() => {
            setMode(mode === 'in' ? 'up' : 'in')
            setError(null)
            setInfo(null)
          }}
        >
          {mode === 'in' ? 'معييش حساب، إنشاء حساب' : 'عندي حساب، تسجيل الدخول'}
        </button>
      </form>
    </main>
  )
}
