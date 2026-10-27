import { AuthProvider, useAuth } from './auth/AuthProvider'
import AuthScreen from './pages/AuthScreen'
import ComingSoon from './pages/ComingSoon'
import Dashboard from './pages/Dashboard'
import Pending from './pages/Pending'
import Projects from './pages/projects/Projects'
import ProjectDetail from './pages/projects/ProjectDetail'
import ProjectReport from './pages/projects/ProjectReport'
import Advances from './pages/advances/Advances'
import AdvanceDetail from './pages/advances/AdvanceDetail'
import AdvanceReport from './pages/advances/AdvanceReport'
import NoAccess from './pages/NoAccess'
import Users from './pages/users/Users'
import Layout from './layout/Layout'
import { ALL_ITEMS } from './layout/nav'
import { useRoute } from './layout/route'

function Content() {
  const { profile, can } = useAuth()
  const route = useRoute()
  const item = ALL_ITEMS.find((i) => i.path === route)
  const section = route.split('/')[0]
  const sectionItem = ALL_ITEMS.find((i) => i.path === section)

  if (sectionItem?.adminOnly && profile?.role !== 'admin') return <ComingSoon title="الصفحة مش موجودة" />
  if (sectionItem?.module && !can(sectionItem.module)) return <NoAccess />
  if (route === 'users') return <Users />
  if (route === 'dashboard') return <Dashboard />
  if (route === 'projects') return <Projects />
  const report = /^projects\/([0-9a-f-]{36})\/report$/.exec(route)
  if (report) return <ProjectReport id={report[1]} />
  const detail = /^projects\/([0-9a-f-]{36})$/.exec(route)
  if (detail) return <ProjectDetail id={detail[1]} />
  if (route === 'advances') return <Advances />
  const advanceReport = /^advances\/([0-9a-f-]{36})\/report$/.exec(route)
  if (advanceReport) return <AdvanceReport id={advanceReport[1]} />
  const advance = /^advances\/([0-9a-f-]{36})$/.exec(route)
  if (advance) return <AdvanceDetail id={advance[1]} />
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
