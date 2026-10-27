import { AuthProvider, useAuth } from './auth/AuthProvider'
import AuthScreen from './pages/AuthScreen'
import ComingSoon from './pages/ComingSoon'
import Dashboard from './pages/Dashboard'
import Pending from './pages/Pending'
import Layout from './layout/Layout'
import { ALL_ITEMS } from './layout/nav'
import { useRoute } from './layout/route'

function Content() {
  const { profile } = useAuth()
  const route = useRoute()
  const item = ALL_ITEMS.find((i) => i.path === route)

  if (route === 'dashboard') return <Dashboard />
  if (!item || (item.adminOnly && profile?.role !== 'admin')) {
    return <ComingSoon title="الصفحة مش موجودة" />
  }
  return <ComingSoon title={item.label} />
}

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
  return (
    <Layout>
      <Content />
    </Layout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
