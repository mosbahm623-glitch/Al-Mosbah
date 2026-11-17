import type { BankChoice } from '../lib/lookups'
import BankPicker from './BankPicker'

/** Bank field of a custody payment: picked from the list, never typed in. */
export default function InstallmentBankField({
  value,
  onChange,
  banks,
}: {
  value: string
  onChange: (name: string) => void
  banks: BankChoice[]
}) {
  return (
    <div className="field">
      البنك / الحساب
      <BankPicker value={value} onChange={onChange} banks={banks} allowNew={false} placeholder="اختار البنك" />
    </div>
  )
}
