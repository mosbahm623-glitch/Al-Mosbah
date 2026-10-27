import { useState, type FormEvent } from 'react'
import Dialog from '../../components/Dialog'
import Segmented from '../../components/Segmented'
import { LEVEL_LABEL, MODULES, type Level, type Module } from '../../auth/permissions'
import { supabase } from '../../lib/supabase'
import type { UserRow } from '../../lib/users'

type Choice = Level | 'none'
const CHOICES = (['none', 'view', 'edit'] as const).map((value) => ({ value, label: LEVEL_LABEL[value] }))
const ROLES = [
  { value: 'user', label: 'مستخدم' },
  { value: 'admin', label: 'أدمن' },
] as const

type Props = { user: UserRow; isSelf: boolean; onClose: () => void; onSaved: () => void }

/** Role, status and one level (none / view / edit) per page. */
export default function UserDialog({ user, isSelf, onClose, onSaved }: Props) {
  const [role, setRole] = useState<'admin' | 'user'>(user.role)
  const [active, setActive] = useState(user.is_active)
  const [levels, setLevels] = useState<Record<Module, Choice>>(
    () => Object.fromEntries(MODULES.map((m) => [m.id, user.permissions.find((p) => p.module === m.id)?.level ?? 'none'])) as Record<Module, Choice>,
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    if (!isSelf && (role !== user.role || active !== user.is_active)) {
      const { error: err } = await supabase.from('profiles').update({ role, is_active: active }).eq('id', user.id)
      if (err) {
        setSaving(false)
        return setError('ما اتحفظش، جرّب تاني')
      }
    }
    const rows = MODULES.flatMap((m) => (levels[m.id] === 'none' ? [] : [{ user_id: user.id, module: m.id, level: levels[m.id] as Level }]))
    const cleared = await supabase.from('user_permissions').delete().eq('user_id', user.id)
    const saved = rows.length ? await supabase.from('user_permissions').insert(rows) : { error: null }
    setSaving(false)
    if (cleared.error || saved.error) return setError('الصلاحيات ما اتحفظتش، افتح المستخدم تاني وراجعها')
    onSaved()
    onClose()
  }

  return (
    <Dialog title={user.full_name ?? 'مستخدم'} subtitle={user.email ?? undefined} onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="dialog-form">
        <div className="field">
          الدور
          <Segmented label="الدور" value={role} options={ROLES} onChange={setRole} />
        </div>
        <label className="check">
          <input type="checkbox" checked={active} disabled={isSelf} onChange={(e) => setActive(e.target.checked)} />
          الحساب مفعّل
        </label>
        {isSelf && <p className="muted small">مينفعش تغيّر دورك أو توقف حسابك بنفسك.</p>}

        {role === 'admin' ? (
          <p className="muted">الأدمن عنده كل الصلاحيات على كل الصفحات.</p>
        ) : (
          <div className="perm-list">
            {MODULES.map((m) => (
              <div className="perm-row" key={m.id}>
                <span className="strong">{m.label}</span>
                <Segmented label={m.label} value={levels[m.id]} options={CHOICES} onChange={(v) => setLevels((s) => ({ ...s, [m.id]: v }))} />
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
