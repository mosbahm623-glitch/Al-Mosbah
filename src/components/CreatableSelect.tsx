import { useState } from 'react'

const NEW = '__new__'

type Props = {
  label: string
  value: string
  options: readonly { value: string; label: string }[]
  placeholder: string
  disabled?: boolean
  required?: boolean
  onChange: (value: string) => void
  /** Saves a new option and returns its value, or null when it failed. */
  onCreate: (name: string) => Promise<string | null>
}

/** A dropdown whose last option lets the admin type and save a new entry in the list. */
export default function CreatableSelect({ label, value, options, placeholder, disabled, required, onChange, onCreate }: Props) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function add() {
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    setFailed(false)
    const created = await onCreate(trimmed)
    setBusy(false)
    if (created === null) return setFailed(true)
    onChange(created)
    setAdding(false)
    setName('')
  }

  return (
    <div className="field">
      <label>
        {label}
        <select
          value={adding ? NEW : value}
          disabled={disabled}
          required={required}
          onChange={(e) => {
            if (e.target.value === NEW) {
              setAdding(true)
            } else {
              setAdding(false)
              onChange(e.target.value)
            }
          }}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
          <option value={NEW}>＋ إضافة جديد…</option>
        </select>
      </label>
      {adding && (
        <div className="add-row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم الجديد" aria-label={`${label} جديد`} autoFocus />
          <button type="button" className="btn" onClick={() => void add()} disabled={busy || !name.trim()}>
            إضافة
          </button>
          {failed && <span className="msg msg-error">ما اتضافش، جرّب تاني</span>}
        </div>
      )}
    </div>
  )
}
