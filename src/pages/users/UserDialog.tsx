import { useState, type FormEvent } from 'react'
import Dialog from '../../components/Dialog'
import Segmented from '../../components/Segmented'
import { useAuth } from '../../auth/AuthProvider'
import { LEVEL_LABEL, MODULES, type Level, type Module } from '../../auth/permissions'
import { TYPE_LABEL, type ProjectType } from '../../lib/format'
import type { Named } from '../../lib/lookups'
import {
  replaceAdvanceAccess,
  replaceBankAccess,
  replacePermissions,
  resetUserPassword,
  setEntryRights,
  setProjectTypes,
  updateRole,
  type AdvanceOption,
  type UserRow,
} from '../../lib/users'

type Choice = Level | 'none'
const CHOICES = (['none', 'view', 'edit'] as const).map((value) => ({ value, label: LEVEL_LABEL[value] }))
const ROLES = [
  { value: 'user', label: 'مستخدم' },
  { value: 'owner', label: 'مالك' },
  { value: 'admin', label: 'أدمن' },
] as const

type Props = {
  user: UserRow
  advances: AdvanceOption[]
  banks: Named[]
  isSelf: boolean
  onClose: () => void
  onSaved: () => void
}

/** Role, status and one level (none / view / edit) per page; for an owner, the banks he may choose from. */
export default function UserDialog({ user, advances, banks, isSelf, onClose, onSaved }: Props) {
  const { isAdmin } = useAuth()
  const [role, setRole] = useState<'admin' | 'owner' | 'user'>(user.role)
  const [active, setActive] = useState(user.is_active)
  const [levels, setLevels] = useState<Record<Module, Choice>>(
    () =>
      Object.fromEntries(
        MODULES.map((m) => [m.id, user.permissions.find((p) => p.module === m.id)?.level ?? 'none']),
      ) as Record<Module, Choice>,
  )
  const [canEditOwn, setCanEditOwn] = useState(user.can_edit_entries)
  const [canDeleteOwn, setCanDeleteOwn] = useState(user.can_delete_entries)
  const [canEditApproved, setCanEditApproved] = useState(user.can_edit_approved)
  const [types, setTypes] = useState<ProjectType[]>(user.project_types)
  const [advanceIds, setAdvanceIds] = useState<string[]>(user.advanceIds)
  const [bankIds, setBankIds] = useState<string[]>(user.bankIds)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetMsg, setResetMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function resetPassword() {
    setResetting(true)
    setResetMsg(null)
    const err = await resetUserPassword(user.id, newPassword)
    setResetting(false)
    if (err) return setResetMsg({ ok: false, text: err })
    setNewPassword('')
    setResetMsg({ ok: true, text: 'اتغيّرت. ابعتها للمستخدم، وهو هيختار كلمة سر خاصة بيه أول ما يدخل.' })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    if (!isSelf && (role !== user.role || active !== user.is_active)) {
      const { error: err } = await updateRole(user.id, role, active)
      if (err) {
        setSaving(false)
        return setError('ما اتحفظش، جرّب تاني')
      }
    }
    if (
      canEditOwn !== user.can_edit_entries ||
      canDeleteOwn !== user.can_delete_entries ||
      canEditApproved !== user.can_edit_approved
    ) {
      const { error: err } = await setEntryRights(user.id, canEditOwn, canDeleteOwn, canEditApproved)
      if (err) {
        setSaving(false)
        return setError('صلاحيات القيود ما اتحفظتش، جرّب تاني')
      }
    }
    if (role !== 'admin' && [...types].sort().join() !== [...user.project_types].sort().join()) {
      const { error: err } = await setProjectTypes(user.id, types)
      if (err) {
        setSaving(false)
        return setError('أنواع المشاريع ما اتحفظتش، جرّب تاني')
      }
    }
    const rows = MODULES.flatMap((m) =>
      levels[m.id] === 'none' ? [] : [{ user_id: user.id, module: m.id, level: levels[m.id] as Level }],
    )
    const { cleared, saved } = await replacePermissions(user.id, rows)
    const wanted = levels.advances === 'none' || role !== 'user' ? [] : advanceIds
    const { cleared: clearedAccess, saved: savedAccess } = await replaceAdvanceAccess(user.id, wanted)
    // only an owner has a list of banks; leaving the owner role clears it. Written only when it changed.
    const wantedBanks = role === 'owner' ? bankIds : []
    const sameBanks = [...wantedBanks].sort().join() === [...user.bankIds].sort().join()
    const bankSave = sameBanks ? null : await replaceBankAccess(user.id, wantedBanks)
    setSaving(false)
    if (bankSave && (bankSave.cleared.error || bankSave.saved.error))
      return setError('البنوك المسموحة ما اتحفظتش، افتح المستخدم تاني وراجعها')
    if (clearedAccess.error || savedAccess.error)
      return setError('العهد المسموحة ما اتحفظتش، افتح المستخدم تاني وراجعها')
    if (cleared.error || saved.error) return setError('الصلاحيات ما اتحفظتش، افتح المستخدم تاني وراجعها')
    onSaved()
    onClose()
  }

  return (
    <Dialog title={user.full_name ?? 'مستخدم'} subtitle={user.email ?? undefined} onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="dialog-form">
        <div className="field">
          الدور
          <Segmented
            label="الدور"
            value={role}
            options={isAdmin ? ROLES : ROLES.filter((r) => r.value !== 'admin')}
            onChange={setRole}
          />
        </div>
        <label className="check">
          <input type="checkbox" checked={active} disabled={isSelf} onChange={(e) => setActive(e.target.checked)} />
          الحساب مفعّل
        </label>
        {isSelf && <p className="muted small">مينفعش تغيّر دورك أو توقف حسابك بنفسك.</p>}

        {role !== 'admin' && (
          <div className="perm-block">
            <span className="strong">أنواع المشاريع المسموحة</span>
            <div className="perm-sub">
              {(Object.keys(TYPE_LABEL) as ProjectType[]).map((t) => (
                <label key={t} className="check">
                  <input
                    type="checkbox"
                    checked={types.includes(t)}
                    onChange={(e) => setTypes((s) => (e.target.checked ? [...s, t] : s.filter((x) => x !== t)))}
                  />
                  {TYPE_LABEL[t]}
                </label>
              ))}
              <small className="muted">المستخدم بيشوف ويصرف على المشاريع من النوع المحدد بس.</small>
            </div>
          </div>
        )}

        {role !== 'user' ? (
          <>
            <p className="muted">
              {role === 'admin'
                ? 'الأدمن عنده كل الصلاحيات على كل الصفحات، وهو الوحيد اللي بيوافق على القيود.'
                : 'المالك عنده كل الصلاحيات على كل الصفحات، لكن قيوده بتستنى موافقة الأدمن ومش بيوافق على حاجة.'}
            </p>
            {role === 'owner' && (
              <div className="perm-block">
                <span className="strong">البنوك اللي يختار منها</span>
                <div className="perm-sub">
                  <span className="muted small">
                    المالك بيختار البنك من القايمة دي بس، ومش بيكتب بنك من عنده. من غير ما تختار بنك مش هيقدر يسجّل قيد
                    ببنك.
                  </span>
                  {banks.length === 0 && <span className="muted small">مفيش بنوك لسه.</span>}
                  {banks.map((b) => (
                    <label className="check" key={b.id}>
                      <input
                        type="checkbox"
                        checked={bankIds.includes(b.id)}
                        onChange={(e) =>
                          setBankIds((ids) => (e.target.checked ? [...ids, b.id] : ids.filter((x) => x !== b.id)))
                        }
                      />
                      {b.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="perm-list">
            {MODULES.map((m) => (
              <div key={m.id} className="perm-block">
                <div className="perm-row">
                  <span className="strong">{m.label}</span>
                  <Segmented
                    label={m.label}
                    value={levels[m.id]}
                    options={CHOICES}
                    onChange={(v) => setLevels((s) => ({ ...s, [m.id]: v }))}
                  />
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
                          onChange={(e) =>
                            setAdvanceIds((ids) => (e.target.checked ? [...ids, a.id] : ids.filter((x) => x !== a.id)))
                          }
                        />
                        {a.holder_name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="perm-block">
              <span className="strong">القيود اللي بيسجّلها</span>
              <div className="perm-rights">
                <label className="perm-right">
                  <input type="checkbox" checked={canEditOwn} onChange={(e) => setCanEditOwn(e.target.checked)} />
                  <span>
                    <b>يعدّل قيوده</b>
                    <small>طول ما القيد لسه مستنّي الموافقة أو مترفوض.</small>
                  </span>
                </label>
                <label className="perm-right">
                  <input type="checkbox" checked={canDeleteOwn} onChange={(e) => setCanDeleteOwn(e.target.checked)} />
                  <span>
                    <b>يمسح قيوده</b>
                    <small>القيد المعتمد مينفعش يتمسح غير بالأدمن.</small>
                  </span>
                </label>
                <label className={canEditOwn ? 'perm-right' : 'perm-right is-off'}>
                  <input
                    type="checkbox"
                    checked={canEditApproved}
                    disabled={!canEditOwn}
                    onChange={(e) => setCanEditApproved(e.target.checked)}
                  />
                  <span>
                    <b>يعدّل قيوده بعد الموافقة عليها</b>
                    <small>القيد يفضل معتمد، وبيوصلك إشعار بالتغيير والسبب.</small>
                  </span>
                </label>
              </div>
            </div>
            <p className="muted small">مشاهدة = يشوف بس · تعديل = يشوف ويضيف ويعدّل ويحذف في الصفحة دي.</p>
          </div>
        )}

        {isAdmin && !isSelf && (
          <div className="perm-block">
            <span className="strong">نسي كلمة السر</span>
            <div className="perm-sub">
              <label className="field">
                كلمة سر جديدة مؤقتة (8 حروف على الأقل)
                <input
                  type="text"
                  dir="ltr"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={resetting || newPassword.length < 8}
                onClick={() => void resetPassword()}
              >
                {resetting ? 'جارٍ التغيير...' : 'تغيير كلمة السر'}
              </button>
              {resetMsg && (
                <p className={resetMsg.ok ? 'msg' : 'msg msg-error'} role="status">
                  {resetMsg.text}
                </p>
              )}
            </div>
          </div>
        )}

        {error && <p className="msg msg-error">{error}</p>}
        <div className="dialog-actions">
          <button className="btn" disabled={saving || (role !== 'admin' && types.length === 0)}>
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
