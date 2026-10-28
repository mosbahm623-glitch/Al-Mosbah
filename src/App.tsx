import { lazy, Suspense } from 'react'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import AuthScreen from './pages/AuthScreen'
import ComingSoon from './pages/ComingSoon'
import Dashboard from './pages/Dashboard'
import Pending from './pages/Pending'
const Projects = lazy(() => import('./pages/projects/Projects'))
const ProjectDetail = lazy(() => import('./pages/projects/ProjectDetail'))
const ProjectReport = lazy(() => import('./pages/projects/ProjectReport'))
const Advances = lazy(() => import('./pages/advances/Advances'))
const AdvanceDetail = lazy(() => import('./pages/advances/AdvanceDetail'))
const AdvanceReport = lazy(() => import('./pages/advances/AdvanceReport'))
import NoAccess from './pages/NoAccess'
const Users = lazy(() => import('./pages/users/Users'))
const Banks = lazy(() => import('./pages/banks/Banks'))
const BankDetail = lazy(() => import('./pages/banks/BankDetail'))
const Approvals = lazy(() => import('./pages/approvals/Approvals'))
const Reports = lazy(() => import('./pages/reports/Reports'))
const Recent = lazy(() => import('./pages/reports/Recent'))
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
  if (route === 'approvals') return <Approvals />
  if (route === 'dashboard') return <Dashboard />
  if (route === 'reports' || route === 'reports/journal') return <Reports />
  if (route === 'recent') return <Recent />
  if (route === 'projects') return <Projects />
  const report = /^projects\/([0-9a-f-]{36})\/report$/.exec(route)
  if (report) return <ProjectReport id={report[1]} />
  const detail = /^projects\/([0-9a-f-]{36})$/.exec(route)
  if (detail) return <ProjectDetail id={detail[1]} />
  if (route === 'banks') return <Banks />
  const bank = /^banks\/([0-9a-f-]{36})$/.exec(route)
  if (bank) return <BankDetail id={bank[1]} />
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
