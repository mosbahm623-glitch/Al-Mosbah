import { useAuth } from '../auth/AuthProvider'

export default function Pending() {
  const { profile, signOut, refreshProfile } = useAuth()
  return (
    <main className="center">
      <div className="card auth">
        <h1>المصباح</h1>
        <p>{profile?.full_name ? `أهلاً ${profile.full_name}` : 'أهلاً بيك'}</p>
        <p className="muted">حسابك لسه مستني تفعيل من الأدمن. أول ما يتفعّل اضغط تحديث.</p>
        <button className="btn" onClick={() => void refreshProfile()}>
          تحديث
        </button>
        <button className="btn btn-link" onClick={() => void signOut()}>
          تسجيل الخروج
        </button>
      </div>
    </main>
  )
}
