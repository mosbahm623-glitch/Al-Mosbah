import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'

/** The lamp: a pendant lamp lighting the dark half of the sign-in page. Pure decoration. */
function Lamp() {
  return (
    <svg className="login-lamp" viewBox="0 0 520 760" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
      <defs>
        <radialGradient id="lp-halo" cx="50%" cy="34%" r="55%"><stop offset="0" stopColor="#ffcf7a" stopOpacity=".55" /><stop offset=".45" stopColor="#e08a3c" stopOpacity=".16" /><stop offset="1" stopColor="#e08a3c" stopOpacity="0" /></radialGradient>
        <linearGradient id="lp-cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffd58a" stopOpacity=".55" /><stop offset=".55" stopColor="#ffb958" stopOpacity=".14" /><stop offset="1" stopColor="#ffb958" stopOpacity="0" /></linearGradient>
        <linearGradient id="lp-dome" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e0604a" /><stop offset=".5" stopColor="#c74634" /><stop offset="1" stopColor="#8f2c20" /></linearGradient>
        <linearGradient id="lp-brass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#8a6a3a" /><stop offset=".45" stopColor="#e6c488" /><stop offset="1" stopColor="#7a5c30" /></linearGradient>
        <radialGradient id="lp-rim" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#fff6dc" /><stop offset=".6" stopColor="#ffd58a" /><stop offset="1" stopColor="#e9a64a" /></radialGradient>
        <radialGradient id="lp-bulb" cx="50%" cy="45%" r="55%"><stop offset="0" stopColor="#fffdf5" /><stop offset=".5" stopColor="#ffe3a6" /><stop offset="1" stopColor="#f6b957" /></radialGradient>
        <radialGradient id="lp-floor" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#ffcf7a" stopOpacity=".5" /><stop offset="1" stopColor="#ffcf7a" stopOpacity="0" /></radialGradient>
        <filter id="lp-soft" x="-60%" y="-120%" width="220%" height="340%"><feGaussianBlur stdDeviation="10" /></filter>
        <filter id="lp-soft2" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>
      <rect width="520" height="760" fill="url(#lp-halo)" />
      <path d="M185 330 L335 330 L480 760 L40 760Z" fill="url(#lp-cone)" filter="url(#lp-soft2)" />
      <ellipse cx="260" cy="735" rx="230" ry="44" fill="url(#lp-floor)" />
      <g fill="#fff3d0">
        <circle cx="230" cy="470" r="1.6" opacity=".7" /><circle cx="292" cy="520" r="1.3" opacity=".6" /><circle cx="262" cy="600" r="1.8" opacity=".5" /><circle cx="205" cy="580" r="1.2" opacity=".5" /><circle cx="318" cy="440" r="1.2" opacity=".6" /><circle cx="244" cy="660" r="1.4" opacity=".4" /><circle cx="330" cy="620" r="1.5" opacity=".4" />
      </g>
      <rect x="258.2" y="-10" width="3.6" height="150" fill="#1a1613" />
      <rect x="244" y="132" width="32" height="30" rx="5" fill="url(#lp-brass)" />
      <rect x="248" y="160" width="24" height="12" rx="2" fill="#6b5028" />
      <ellipse cx="260" cy="330" rx="86" ry="28" fill="#ffd58a" opacity=".75" filter="url(#lp-soft)" />
      <path d="M110 330 C110 235 172 168 260 168 C348 168 410 235 410 330 Z" fill="url(#lp-dome)" />
      <path d="M132 300 C140 238 184 198 232 190" fill="none" stroke="#fff" strokeOpacity=".32" strokeWidth="6" strokeLinecap="round" />
      <ellipse cx="260" cy="330" rx="150" ry="22" fill="url(#lp-rim)" />
      <ellipse cx="260" cy="330" rx="150" ry="22" fill="none" stroke="#fff3d0" strokeOpacity=".6" strokeWidth="1.5" />
      <circle cx="260" cy="338" r="34" fill="#ffe7b0" opacity=".9" filter="url(#lp-soft)" />
      <circle cx="260" cy="336" r="22" fill="url(#lp-bulb)" />
    </svg>
  )
}

const BulbMark = () => (
  <span className="login-mark" aria-hidden="true">
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6 M10 21h4 M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" />
    </svg>
  </span>
)

export default function AuthScreen() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
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
    <main className="login">
      <section className="login-form-side">
        <div className="login-logo">
          <BulbMark />
          المصباح
        </div>
        <form className="login-box" onSubmit={onSubmit}>
          <h1>تسجيل الدخول</h1>
          <p className="login-lead">ادخل بحسابك عشان توصل لمشاريعك وقيودك.</p>

          <div className="login-field">
            <label htmlFor="login-email">الإيميل</label>
            <div className="login-input">
              <Mail className="login-ic" size={19} aria-hidden="true" />
              <input id="login-email" type="email" dir="ltr" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </div>
          </div>
          <div className="login-field">
            <label htmlFor="login-password">كلمة السر</label>
            <div className="login-input">
              <Lock className="login-ic" size={19} aria-hidden="true" />
              <input id="login-password" type={show ? 'text' : 'password'} dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
              <button type="button" className="login-eye" onClick={() => setShow(!show)} aria-label={show ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'}>
                {show ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </div>

          {error && <p className="msg msg-error" role="alert">{error}</p>}

          <button className="login-submit" type="submit" disabled={busy}>
            {busy ? 'لحظة...' : 'دخول'}
          </button>
          <p className="login-help">مش قادر تدخل؟ كلّم المسؤول عن حسابك.</p>
        </form>
        <p className="login-foot">
          <Lock size={15} aria-hidden="true" />
          اتصال مشفّر وبياناتك محفوظة بصلاحيات لكل مستخدم
        </p>
      </section>

      <section className="login-art" aria-hidden="true">
        <Lamp />
      </section>
    </main>
  )
}
