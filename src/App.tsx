import { Suspense } from 'react'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { checkAccess } from './auth/access'
import AuthScreen from './pages/AuthScreen'
import NoAccess from './pages/NoAccess'
import NotFound from './pages/NotFound'
import Pending from './pages/Pending'
import Layout from './layout/Layout'
import { ALL_ITEMS } from './layout/nav'
import { useRoute } from './layout/route'
import { matchRoute } from './layout/routes'

function Content() {
  const auth = useAuth()
  const route = useRoute()
  const matched = matchRoute(route)
  if (matched?.def.open) return <matched.def.page id={matched.id} />

  const section = ALL_ITEMS.find((i) => i.path === route.split('/')[0])
  const allowed = checkAccess(section?.access, auth)
  if (allowed === 'no-access') return <NoAccess />
  if (allowed === 'not-found' || !matched) return <NotFound />
  return <matched.def.page id={matched.id} />
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
      <Suspense fallback={<p className="muted">جارٍ التحميل...</p>}>
        <Content />
      </Suspense>
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
