/**
 * A refund (مرتجع) is stored as an expense with a negative amount: every total in the database (project, bank,
 * custody, dashboard) then takes it off by itself. These helpers tell it apart and say how to show it.
 */
type KindAmount = { kind: 'income' | 'expense'; amount: number }

export const isRefund = (e: KindAmount) => e.kind === 'expense' && e.amount < 0

/** Money coming in: an income or a refund (shown with + and green). */
export const isMoneyIn = (e: KindAmount) => e.kind === 'income' || isRefund(e)

export const kindLabel = (e: KindAmount) => (e.kind === 'income' ? 'وارد' : isRefund(e) ? 'مرتجع' : 'مصروف')

/** The sign and the positive number to print next to an entry: "+" / "−" and the amount without its own minus. */
export const signedAmount = (e: KindAmount) => ({ sign: isMoneyIn(e) ? '+' : '−', value: Math.abs(e.amount) })

/** Title line of an entry: an income has only its label, an expense (or refund) has the category and the item. */
export const entryTitle = (e: KindAmount & { category: string; item: string | null }) =>
  e.kind === 'income' ? e.category : `${e.category} · ${e.item ?? ''}`

/** The colour class for an amount: green for money in, red for money out. */
export const amountTone = (e: KindAmount) => (isMoneyIn(e) ? 'tone-text-ok' : 'tone-text-err')
