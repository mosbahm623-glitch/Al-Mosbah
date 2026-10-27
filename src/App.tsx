import { AuthProvider, useAuth } from './auth/AuthProvider'
import AuthScreen from './pages/AuthScreen'
import Dashboard from './pages/Dashboard'
import Pending from './pages/Pending'

function Gate() {
  const { loading, session, profile } = useAuth()
  if (loading) {
    return (
      <main className="center">
        <p className="muted">جارٍ التحميل...</p>
      </main>
    )
  }
  if (!session) return <AuthScreen />
  if (!profile?.is_active) return <Pending />
  return <Dashboard />
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
