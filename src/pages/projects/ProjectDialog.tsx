import { useState, type FormEvent } from 'react'
import Dialog from '../../components/Dialog'
import Segmented from '../../components/Segmented'
import { supabase } from '../../lib/supabase'
import { TYPE_LABEL, type ProjectType } from '../../lib/format'
import type { ProjectSummary } from '../../lib/projects'

const TYPES = (Object.keys(TYPE_LABEL) as ProjectType[]).map((value) => ({ value, label: TYPE_LABEL[value] }))
const STATUSES = [
  { value: 'active', label: 'نشط' },
  { value: 'closed', label: 'مقفول' },
] as const

type Props = { project?: ProjectSummary; onClose: () => void; onSaved: () => void }

export default function ProjectDialog({ project, onClose, onSaved }: Props) {
  const [name, setName] = useState(project?.name ?? '')
  const [type, setType] = useState<ProjectType>(project?.type ?? 'finishing')
  const [status, setStatus] = useState<'active' | 'closed'>(project?.status ?? 'active')
  const [budget, setBudget] = useState(project ? String(project.budget) : '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const amount = Number(budget || 0)
    if (!name.trim()) return setError('اكتب اسم المشروع')
    if (!Number.isFinite(amount) || amount < 0) return setError('الميزانية لازم تكون رقم صحيح')
    setSaving(true)
    setError(null)
    const row = { name: name.trim(), type, status, budget: amount }
    const { error: err } = project
      ? await supabase.from('projects').update(row).eq('id', project.id)
      : await supabase.from('projects').insert(row)
    setSaving(false)
    if (err) return setError('ما اتحفظش، جرّب تاني')
    onSaved()
    onClose()
  }

  return (
    <Dialog title={project ? 'تعديل المشروع' : 'مشروع جديد'} subtitle={project?.name} onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="dialog-form">
        <label className="field">
          اسم المشروع
          <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </label>
        <div className="field">
          النوع
          <Segmented label="نوع المشروع" value={type} options={TYPES} onChange={setType} />
        </div>
        <label className="field">
          الميزانية (ج.م)
          <input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal" placeholder="0" />
        </label>
        {project && (
          <div className="field">
            الحالة
            <Segmented label="حالة المشروع" value={status} options={STATUSES} onChange={setStatus} />
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
