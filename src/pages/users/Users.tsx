import { useState } from 'react'
import PageHead from '../../components/PageHead'
import { Pencil, Plus } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { LEVEL_LABEL, MODULES } from '../../auth/permissions'
import { fetchAdvanceOptions, fetchUsers, type AdvanceOption, type UserRow } from '../../lib/users'
import { useAsync } from '../../lib/useAsync'
import NewUserDialog from './NewUserDialog'
import UserDialog from './UserDialog'

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
                  <th>الإيميل</th>
                  <th>الدور</th>
                  <th>الحالة</th>
                  <th>الصفحات</th>
                  <th>
                    <span className="sr-only">إجراءات</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.data.map((u) => (
                  <tr key={u.id}>
                    <td className="strong">{u.full_name ?? '—'}</td>
                    <td className="muted" dir="ltr">
                      {u.email}
                    </td>
                    <td>{u.role === 'admin' ? 'أدمن' : u.role === 'owner' ? 'مالك' : 'مستخدم'}</td>
                    <td>
                      <span className={`chip ${u.is_active ? 'chip-ok' : 'chip-neutral'}`}>
                        <span className="dot" />
                        {u.is_active ? 'مفعّل' : 'موقوف'}
                      </span>
                    </td>
                    <td className="muted small">
                      {u.role !== 'user'
                        ? 'كل الصفحات'
                        : u.permissions.length
                          ? MODULES.flatMap((m) => {
                              const p = u.permissions.find((x) => x.module === m.id)
                              return p
                                ? [
                                    m.id === 'advances'
                                      ? `${m.label} (${LEVEL_LABEL[p.level]} · ${u.advanceIds.length} عهدة)`
                                      : `${m.label} (${LEVEL_LABEL[p.level]})`,
                                  ]
                                : []
                            }).join(' · ')
                          : 'مفيش صلاحيات'}
                    </td>
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
