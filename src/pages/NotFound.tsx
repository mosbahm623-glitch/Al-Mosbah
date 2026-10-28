/** Shown for an address that does not exist, or a page the account must not even know about. */
export default function NotFound() {
  return (
    <div className="page-stack">
      <h1 className="page-title">الصفحة مش موجودة</h1>
      <a className="btn btn-ghost" href="#/dashboard">
        رجوع للرئيسية
      </a>
    </div>
  )
}
