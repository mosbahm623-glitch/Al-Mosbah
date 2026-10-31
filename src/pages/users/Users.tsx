import { useState } from 'react'
import PageHead from '../../components/PageHead'
import { Pencil, Plus } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { LEVEL_LABEL, MODULES } from '../../auth/permissions'
import { fetchAdvanceOptions, fetchUsers, type AdvanceOption, type UserRow } from '../../lib/users'
import { useAsync } from '../../lib/useAsync'
import NewUserDialog from './NewUserDialog'
import UserDialog from './UserDialog'

const roleText = (role: UserRow['role']) => (role === 'admin' ? 'أدمن' : role === 'owner' ? 'مالك' : 'مستخدم')

/** The pages a person can open, in one line. */
function pagesText(u: UserRow) {
  if (u.role !== 'user') return 'كل الصفحات'
  if (!u.permissions.length) return 'مفيش صلاحيات'
  return MODULES.flatMap((m) => {
    const p = u.permissions.find((x) => x.module === m.id)
    if (!p) return []
    return [
      m.id === 'advances'
        ? `${m.label} (${LEVEL_LABEL[p.level]} · ${u.advanceIds.length} عهدة)`
        : `${m.label} (${LEVEL_LABEL[p.level]})`,
    ]
  }).join(' · ')
}

export default function Users() {
  const { profile, isAdmin } = useAuth()
  const users = useAsync<UserRow[]>(fetchUsers)
  const advances = useAsync<AdvanceOption[]>(fetchAdvanceOptions)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<UserRow | null>(null)

  return (
    <div className="page-stack">
      <PageHead
        title="المستخدمين والصلاحيات"
        crumb="المستخدمين"
        actions={
          <button className="btn btn-icon" onClick={() => setAdding(true)}>
            <Plus size={18} aria-hidden="true" />
            مستخدم جديد
          </button>
        }
      />

      {users.failed && <p className="msg msg-error">مقدرناش نحمّل المستخدمين، جرّب تاني</p>}
      {users.loading && !users.data && <p className="muted">جارٍ التحميل...</p>}

      {users.data && (
        <section className="panel">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th className="sm-hide">الإيميل</th>
                  <th className="sm-hide">الدور</th>
                  <th className="sm-hide">الحالة</th>
                  <th className="sm-hide">الصفحات</th>
                  <th>
                    <span className="sr-only">إجراءات</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.data.map((u) => (
                  <tr key={u.id}>
                    <td className="strong">
                      {u.full_name ?? '—'}
                      <span className="sub" dir="ltr">
                        {u.email}
                      </span>
                      <span className="sub">
                        {roleText(u.role)} · {u.is_active ? 'مفعّل' : 'موقوف'}
                      </span>
                      <span className="sub">{pagesText(u)}</span>
                    </td>
                    <td className="muted sm-hide" dir="ltr">
                      {u.email}
                    </td>
                    <td className="sm-hide">{roleText(u.role)}</td>
                    <td className="sm-hide">
                      <span className={`chip ${u.is_active ? 'chip-ok' : 'chip-neutral'}`}>
                        <span className="dot" />
                        {u.is_active ? 'مفعّل' : 'موقوف'}
                      </span>
                    </td>
                    <td className="muted small sm-hide">{pagesText(u)}</td>
                    <td>
                      {(isAdmin || u.role !== 'admin') && (
                        <button
                          className="icon-btn"
                          aria-label={`صلاحيات ${u.full_name ?? ''}`}
                          onClick={() => setEditing(u)}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {adding && <NewUserDialog onClose={() => setAdding(false)} onCreated={users.reload} />}
      {editing && advances.data && (
        <UserDialog
          user={editing}
          advances={advances.data}
          isSelf={editing.id === profile?.id}
          onClose={() => setEditing(null)}
          onSaved={users.reload}
        />
      )}
    </div>
  )
}
