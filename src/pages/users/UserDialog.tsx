import { useState, type FormEvent } from 'react'
import Dialog from '../../components/Dialog'
import Segmented from '../../components/Segmented'
import { useAuth } from '../../auth/AuthProvider'
import { LEVEL_LABEL, MODULES, type Level, type Module } from '../../auth/permissions'
import { saveUserAccess, type AdvanceOption, type UserRow } from '../../lib/users'

type Choice = Level | 'none'
const CHOICES = (['none', 'view', 'edit'] as const).map((value) => ({ value, label: LEVEL_LABEL[value] }))
const ROLES = [
  { value: 'user', label: 'مستخدم' },
  { value: 'owner', label: 'مالك' },
  { value: 'admin', label: 'أدمن' },
] as const

type Props = { user: UserRow; advances: AdvanceOption[]; isSelf: boolean; onClose: () => void; onSaved: () => void }

/** Role, status and one level (none / view / edit) per page. */
export default function UserDialog({ user, advances, isSelf, onClose, onSaved }: Props) {
  const { isAdmin } = useAuth()
  const [role, setRole] = useState<'admin' | 'owner' | 'user'>(user.role)
  const [active, setActive] = useState(user.is_active)
  const [levels, setLevels] = useState<Record<Module, Choice>>(
    () => Object.fromEntries(MODULES.map((m) => [m.id, user.permissions.find((p) => p.module === m.id)?.level ?? 'none'])) as Record<Module, Choice>,
  )
  const [advanceIds, setAdvanceIds] = useState<string[]>(user.advanceIds)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const permissions = MODULES.flatMap((m) => (levels[m.id] === 'none' ? [] : [{ module: m.id, level: levels[m.id] as Level }]))
    const result = await saveUserAccess({
      userId: user.id,
      changeProfile: !isSelf && (role !== user.role || active !== user.is_active),
      role,
      active,
      permissions,
      advanceIds: levels.advances === 'none' || role !== 'user' ? [] : advanceIds,
    })
    setSaving(false)
    if (result === 'profile-failed') return setError('ما اتحفظش، جرّب تاني')
    if (result === 'access-failed') return setError('العهد المسموحة ما اتحفظتش، افتح المستخدم تاني وراجعها')
    if (result === 'permissions-failed') return setError('الصلاحيات ما اتحفظتش، افتح المستخدم تاني وراجعها')
    onSaved()
    onClose()
  }

  return (
    <Dialog title={user.full_name ?? 'مستخدم'} subtitle={user.email ?? undefined} onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="dialog-form">
        <div className="field">
          الدور
          <Segmented label="الدور" value={role} options={isAdmin ? ROLES : ROLES.filter((r) => r.value !== 'admin')} onChange={setRole} />
        </div>
        <label className="check">
          <input type="checkbox" checked={active} disabled={isSelf} onChange={(e) => setActive(e.target.checked)} />
          الحساب مفعّل
        </label>
        {isSelf && <p className="muted small">مينفعش تغيّر دورك أو توقف حسابك بنفسك.</p>}

        {role !== 'user' ? (
          <p className="muted">
            {role === 'admin' ? 'الأدمن عنده كل الصلاحيات على كل الصفحات، وهو الوحيد اللي بيوافق على القيود.' : 'المالك عنده كل الصلاحيات على كل الصفحات، لكن قيوده بتستنى موافقة الأدمن ومش بيوافق على حاجة.'}
          </p>
        ) : (
          <div className="perm-list">
            {MODULES.map((m) => (
              <div key={m.id} className="perm-block">
                <div className="perm-row">
                  <span className="strong">{m.label}</span>
                  <Segmented label={m.label} value={levels[m.id]} options={CHOICES} onChange={(v) => setLevels((s) => ({ ...s, [m.id]: v }))} />
                </div>
                {m.id === 'advances' && levels.advances !== 'none' && (
                  <div className="perm-sub">
                    <span className="muted small">يشوف العهد دي بس:</span>
                    {advances.length === 0 && <span className="muted small">مفيش عهد لسه.</span>}
                    {advances.map((a) => (
                      <label className="check" key={a.id}>
                        <input
                          type="checkbox"
                          checked={advanceIds.includes(a.id)}
                          onChange={(e) => setAdvanceIds((ids) => (e.target.checked ? [...ids, a.id] : ids.filter((x) => x !== a.id)))}
                        />
                        {a.holder_name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <p className="muted small">مشاهدة = يشوف بس · تعديل = يشوف ويضيف ويعدّل ويحذف في الصفحة دي.</p>
          </div>
        )}

        {error && <p className="msg msg-error">{error}</p>}
        <div className="dialog-actions">
          <button className="btn" disabled={saving}>
            {saving ? 'جارٍ الحفظ...' : 'حفظ'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </form>
    </Dialog>
  )
}
