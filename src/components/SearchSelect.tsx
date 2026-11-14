import { useState } from 'react'

type Props = {
  label: string
  value: string
  options: readonly string[]
  placeholder: string
  disabled?: boolean
  /** true: any typed text is the value (suggestions only); false: the value can only be picked from the list */
  freeText?: boolean
  onChange: (value: string) => void
  /** Saves a typed name that is not in the list and returns it, or null when it failed. */
  onCreate?: (name: string) => Promise<string | null>
}

/** A field you can type in to search the list, then pick from it. */
export default function SearchSelect({
  label,
  value,
  options,
  placeholder,
  disabled,
  freeText,
  onChange,
  onCreate,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const text = query ?? value
  const q = (query ?? '').trim().toLowerCase()
  const shown = q ? options.filter((o) => o.toLowerCase().includes(q)) : options
  const exact = options.some((o) => o.toLowerCase() === q)

  function pick(v: string) {
    onChange(v)
    setQuery(null)
    setOpen(false)
  }

  async function create() {
    setBusy(true)
    setFailed(false)
    const created = await onCreate?.((query ?? '').trim())
    setBusy(false)
    if (created === null || created === undefined) return setFailed(true)
    pick(created)
  }

  return (
    <div className="field">
      {label}
      <div
        className="bank-picker"
        onBlur={() => {
          setOpen(false)
          setQuery(null)
        }}
      >
        <div className="bank-picker-box">
          <input
            value={text}
            disabled={disabled}
            placeholder={placeholder}
            aria-label={label}
            autoComplete="off"
            onChange={(e) => {
              setQuery(e.target.value)
              if (freeText || !e.target.value) onChange(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          />
        </div>
        {open && (
          <ul className="bank-picker-list" role="listbox">
            {shown.map((o) => (
              <li key={o}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o === value}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o)}
                >
                  {o}
                </button>
              </li>
            ))}
            {onCreate && q && !exact && (
              <li>
                <button
                  type="button"
                  disabled={busy}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void create()}
                >
                  ＋ إضافة «{(query ?? '').trim()}»
                </button>
              </li>
            )}
            {shown.length === 0 && !(onCreate && q) && <li className="muted bank-picker-empty">مفيش نتايج</li>}
          </ul>
        )}
      </div>
      {failed && <span className="msg msg-error">ما اتضافش، جرّب تاني</span>}
    </div>
  )
}
