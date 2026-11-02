import { useState, type FormEvent } from 'react'
import Dialog from '../../components/Dialog'
import FormActions from '../../components/FormActions'
import { createContractor } from '../../lib/catalog'

export default function ContractorDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (name.trim().length < 2) return setError('اكتب اسم المقاول')
    setSaving(true)
    const id = await createContractor(name.trim())
    setSaving(false)
    if (!id) return setError('ما اتحفظش، جرّب تاني')
    onSaved()
    onClose()
  }

  return (
    <Dialog title="مقاول جديد" onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="dialog-form">
        <label className="field">
          اسم المقاول
          <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </label>
        {error && <p className="msg msg-error">{error}</p>}
        <FormActions saving={saving} onClose={onClose} />
      </form>
    </Dialog>
  )
}
