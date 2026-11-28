import { lazy, Suspense, useState } from 'react'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import AuthScreen from './pages/AuthScreen'
import ComingSoon from './pages/ComingSoon'
import Dashboard from './pages/Dashboard'
import ChangePassword from './pages/ChangePassword'
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
const Contractors = lazy(() => import('./pages/contractors/Contractors'))
const ContractorDetail = lazy(() => import('./pages/contractors/ContractorDetail'))
const Backup = lazy(() => import('./pages/Backup'))
const Search = lazy(() => import('./pages/Search'))
const Duplicates = lazy(() => import('./pages/reports/Duplicates'))
const Notifications = lazy(() => import('./pages/Notifications'))
const BulkInvoices = lazy(() => import('./pages/BulkInvoices'))
const MergeContractorNames = lazy(() => import('./pages/MergeContractorNames'))
const MergeCategoryNames = lazy(() => import('./pages/MergeCategoryNames'))
const QuickEntry = lazy(() => import('./pages/QuickEntry'))
const VoiceEntry = lazy(() => import('./pages/voice/VoiceEntry'))
const SharedProject = lazy(() => import('./pages/SharedProject'))
import PageErrorBoundary from './components/PageErrorBoundary'
import Layout from './layout/Layout'
import { ALL_ITEMS } from './layout/nav'
import { useRoute } from './layout/route'
import { keepsAlive, useOpenPaths } from './layout/useTabs'
import { shareTokenOf } from './lib/projects/shares'

function Content({ route }: { route: string }) {
  const { isAdmin, isStaff, isOwner, can } = useAuth()
  const item = ALL_ITEMS.find((i) => i.path === route)
  const section = route.split('/')[0]
  const sectionItem = ALL_ITEMS.find((i) => i.path === section)

  if (route === 'notifications') return <Notifications />
  if (route === 'quick-entry') return isOwner ? <QuickEntry /> : <ComingSoon title="الصفحة مش موجودة" />
  if ((sectionItem?.adminOnly && !isAdmin) || (sectionItem?.staffOnly && !isStaff))
    return <ComingSoon title="الصفحة مش موجودة" />
  if (sectionItem?.module && !can(sectionItem.module)) return <NoAccess />
  if (route === 'users') return <Users />
  if (route === 'backup') return <Backup />
  if (route === 'approvals') return <Approvals />
  if (route === 'duplicates') return isAdmin ? <Duplicates /> : <ComingSoon title="الصفحة مش موجودة" />
  if (route === 'dashboard') return <Dashboard />
  if (route === 'reports' || route === 'reports/journal') return <Reports />
  if (route === 'recent') return <Recent />
  if (route === 'search') return <Search />
  if (route === 'voice-entry') return <VoiceEntry />
  if (route === 'bulk-invoices') return <BulkInvoices />
  if (route === 'merge-contractors') return <MergeContractorNames />
  if (route === 'merge-categories') return <MergeCategoryNames />
  if (route === 'projects') return <Projects />
  const report = /^projects\/([0-9a-f-]{36})\/report$/.exec(route)
  if (report) return <ProjectReport id={report[1]} />
  const detail = /^projects\/([0-9a-f-]{36})$/.exec(route)
  if (detail) return <ProjectDetail id={detail[1]} />
  if (route === 'banks') return <Banks />
  const bank = /^banks\/([0-9a-f-]{36})$/.exec(route)
  if (bank) return <BankDetail id={bank[1]} />
  if (route === 'contractors') return <Contractors />
  const contractor = /^contractors\/([0-9a-f-]{36})$/.exec(route)
  if (contractor) return <ContractorDetail id={contractor[1]} />
  if (route === 'advances') return <Advances />
  const advanceReport = /^advances\/([0-9a-f-]{36})\/report$/.exec(route)
  if (advanceReport) return <AdvanceReport id={advanceReport[1]} />
  const advance = /^advances\/([0-9a-f-]{36})$/.exec(route)
  if (advance) return <AdvanceDetail id={advance[1]} />
  if (!item || (item.adminOnly && !isAdmin) || (item.staffOnly && !isStaff)) {
    return <ComingSoon title="الصفحة مش موجودة" />
  }
  return <ComingSoon title={item.label} />
}

const KEPT = 6

/**
 * The page on screen, plus the other pages that are open as tabs. Those stay mounted but hidden, so coming back to a
 * tab finds it exactly as it was left (what was typed, filters, scroll) instead of loading it again.
 */
function Page() {
  const route = useRoute()
  const open = useOpenPaths()
  const [visited, setVisited] = useState<string[]>([route])
  if (keepsAlive(route) && !visited.includes(route)) {
    // pages in the order they were first opened (adjusting state while rendering, not in an effect)
    const next = [...visited, route]
    while (next.length > KEPT) next.shift()
    setVisited(next)
  }
  const shown = visited.filter((r) => r === route || (open.has(r) && keepsAlive(r)))
  if (!shown.includes(route)) shown.push(route)
  return (
    <>
      {shown.map((r) => (
        <div className="keep" key={r} data-page={r} hidden={r !== route}>
          <PageErrorBoundary>
            <Content route={r} />
          </PageErrorBoundary>
        </div>
      ))}
    </>
  )
}

function Gate() {
  const { loading, session, profile, loadFailed, refreshProfile } = useAuth()
  if (loading) {
    return (
      <main className="center">
        <p className="muted">جارٍ التحميل...</p>
      </main>
    )
  }
  if (!session) return <AuthScreen />
  if (!profile && loadFailed) {
    return (
      <main className="center">
        <div className="card auth">
          <h1>Legacy ERP</h1>
          <p className="muted">مقدرتش أحمّل بيانات حسابك. اتأكد من النت وجرّب تاني.</p>
          <button className="btn" onClick={() => void refreshProfile()}>
            حاول تاني
          </button>
        </div>
      </main>
    )
  }
  if (!profile?.is_active) return <Pending />
  if (profile.must_change_password) return <ChangePassword />
  return (
    <Layout>
      <Suspense fallback={<p className="muted">جارٍ التحميل...</p>}>
        <Page />
      </Suspense>
    </Layout>
  )
}

export default function App() {
  const shareToken = shareTokenOf(useRoute())
  // a client link opens the read-only project page with no sign-in at all
  if (shareToken) {
    return (
      <Suspense fallback={<p className="muted">جارٍ التحميل...</p>}>
        <SharedProject token={shareToken} />
      </Suspense>
    )
  }
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
