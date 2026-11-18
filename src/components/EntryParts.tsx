import { isMoneyIn, kindLabel, signedAmount } from '../lib/entries/entryKind'
import { money } from '../lib/core/format'

type Props = { entry: { kind: 'income' | 'expense'; amount: number } }

/** «مصروف» / «وارد» / «مرتجع» as a coloured chip: the same on every list and card. */
export function KindChip({ entry }: Props) {
  return (
    <span className={`chip ${isMoneyIn(entry) ? 'chip-ok' : 'chip-err'}`}>
      <span className="dot" />
      {kindLabel(entry)}
    </span>
  )
}

/** The sign and the amount of an entry ("+7,000" for money in, "−3,200" for money out). */
export function AmountText({ entry }: Props) {
  const { sign, value } = signedAmount(entry)
  return (
    <>
      {sign}
      {money(value)}
    </>
  )
}
