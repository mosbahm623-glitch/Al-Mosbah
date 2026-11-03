import { useState } from 'react'
import type { BankChoice } from '../lib/lookups'
import BankLogo from './BankLogo'

type Props = {
  value: string
  onChange: (name: string) => void
  banks: BankChoice[]
  /** false: the name can only be picked from the list (an owner); true: a new bank name may also be typed */
  allowNew: boolean
  placeholder: string
}

/** Bank field with a list that shows each bank's logo. */
export default function BankPicker({ value, onChange, banks, allowNew, placeholder }: Props) {
  const [open, setOpen] = useState(false)
  const chosen = banks.find((b) => b.name === value)
  const q = value.trim().toLowerCase()
  const shown = allowNew && q && !chosen ? banks.filter((b) => b.name.toLowerCase().includes(q)) : banks

  return (
    <div className="bank-picker" onBlur={() => setOpen(false)}>
      <div className="bank-picker-box">
        {chosen && <BankLogo logo={chosen.logo} name={chosen.name} />}
        <input
          value={value}
          readOnly={!allowNew}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          autoComplete="off"
        />
      </div>
      {open && (
        <ul className="bank-picker-list" role="listbox">
          {!allowNew && (
            <li>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => (onChange(''), setOpen(false))}
              >
                <span className="muted">من غير اختيار</span>
              </button>
            </li>
          )}
          {shown.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                role="option"
                aria-selected={b.name === value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => (onChange(b.name), setOpen(false))}
              >
                <BankLogo logo={b.logo} name={b.name} />
                {b.name}
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="muted bank-picker-empty">مفيش بنوك</li>}
        </ul>
      )}
    </div>
  )
}
