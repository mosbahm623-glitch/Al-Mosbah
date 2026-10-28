import { ALL_ITEMS } from '../layout/nav'
import { useAuth } from '../auth/AuthProvider'

/** Shown when the account has no permission for the page; offers the first page it can open. */
export default function NoAccess() {
  const { can } = useAuth()
  const first = ALL_ITEMS.find((i) => i.access?.module && can(i.access.module))
  return (
    <div className="page-stack">
      <h1 className="page-title">مفيش صلاحية للصفحة دي</h1>
      <p className="muted">اطلب من الأدمن يفتحهالك.</p>
      {first ? (
        <a className="btn btn-ghost" href={`#/${first.path}`}>
          روح لـ {first.label}
        </a>
      ) : (
        <p className="muted">حسابك لسه ملوش صلاحيات على أي صفحة.</p>
      )}
    </div>
  )
}
