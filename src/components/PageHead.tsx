import type { ReactNode } from 'react'

type Props = {
  title: string
  /** breadcrumb label of this page when it differs from the title */
  crumb?: string
  /** the list page this one belongs to (detail pages) */
  parent?: { label: string; href: string }
  /** chips next to the title */
  chips?: ReactNode
  note?: string | null
  actions?: ReactNode
}

/** Breadcrumbs + title (+ chips and note) on one side, page actions on the other. */
export default function PageHead({ title, crumb, parent, chips, note, actions }: Props) {
  return (
    <div className="page-head">
      <div>
        <nav className="crumbs" aria-label="مسار التنقل">
          <span>الرئيسية</span>
          <span aria-hidden="true">‹</span>
          {parent && (
            <>
              <a href={parent.href}>{parent.label}</a>
              <span aria-hidden="true">‹</span>
            </>
          )}
          <span className="crumb-current">{crumb ?? title}</span>
        </nav>
        {chips ? (
          <div className="title-row">
            <h1 className="page-title">{title}</h1>
            {chips}
          </div>
        ) : (
          <h1 className="page-title">{title}</h1>
        )}
        {note && <p className="muted small">{note}</p>}
      </div>
      {actions && <div className="head-actions">{actions}</div>}
    </div>
  )
}
