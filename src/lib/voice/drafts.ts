import type { Category } from '../entries/catalog'
import type { Named } from '../core/lookups'

export const DRAFT_TYPES = {
  expense: 'مصروف',
  refund: 'مرتجع',
  income: 'وارد',
  custody_expense: 'مصروف عهدة',
  custody_payment: 'دفعة عهدة',
} as const
export type DraftType = keyof typeof DRAFT_TYPES

/** One entry as the model heard it: names as text, nothing trusted yet. */
export type HeardDraft = {
  ref?: string
  type?: string
  project?: string
  category?: string
  item?: string
  contractor?: string
  no_contractor?: boolean
  bank?: string
  custody?: string
  amount?: number
  date?: string
  notes?: string
  suggested?: string[]
  question?: string
}

/** One entry on screen: every name is one of the app's own, or empty. */
export type Draft = {
  /** also the id the entry is saved with, so a repeated try can never make a second entry */
  id: string
  type: DraftType
  project: string
  category: string
  item: string
  contractor: string
  noContractor: boolean
  bank: string
  custody: string
  amount: string
  date: string
  notes: string
  suggested: string[]
  question: string
  files: File[]
  noInvoice: boolean
}

export type Lists = {
  projects: Named[]
  categories: Category[]
  contractors: Named[]
  banks: Named[]
  custodies: Named[]
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** The list's own spelling of a heard name; empty when it is not in the list. */
const pick = (heard: string | undefined, list: { name: string }[]) =>
  (heard && list.find((x) => same(x.name, heard))?.name) || ''

export const needsProject = (t: DraftType) => t !== 'custody_payment'
export const needsCategory = (t: DraftType) => t === 'expense' || t === 'refund' || t === 'custody_expense'
export const needsBank = (t: DraftType) => t !== 'custody_expense'
export const needsCustody = (t: DraftType) => t === 'custody_expense' || t === 'custody_payment'

/** An invoice photo (or «بدون فاتورة») and, on an expense, a contractor choice: custody expenses and all an owner's entries. */
export const needsProof = (t: DraftType, owner: boolean) =>
  t !== 'custody_payment' && (owner || t === 'custody_expense')

/**
 * Turns what was heard into cards. With `lists` null (trial mode: the names are invented) they are shown as heard.
 * A card that already exists (same ref) keeps its id and the photos picked on it.
 */
export function toDrafts(heard: HeardDraft[], lists: Lists | null, before: Draft[], today: string): Draft[] {
  return heard.map((h) => {
    const old = before.find((d) => d.id === h.ref)
    const type = h.type && h.type in DRAFT_TYPES ? (h.type as DraftType) : 'expense'
    const name = (value: string | undefined, list: keyof Lists) =>
      lists ? pick(value, lists[list]) : (value?.trim() ?? '')
    const noContractor = Boolean(h.no_contractor)
    return {
      id: old?.id ?? crypto.randomUUID(),
      type,
      project: name(h.project, 'projects'),
      category: name(h.category, 'categories'),
      item: h.item?.trim() ?? '',
      contractor: noContractor ? '' : name(h.contractor, 'contractors'),
      noContractor,
      bank: name(h.bank, 'banks'),
      custody: name(h.custody, 'custodies'),
      amount: h.amount && h.amount > 0 ? String(h.amount) : '',
      date: /^\d{4}-\d{2}-\d{2}$/.test(h.date ?? '') ? h.date! : today,
      notes: h.notes?.trim() ?? '',
      suggested: h.suggested ?? [],
      question: h.question?.trim() ?? '',
      files: old?.files ?? [],
      noInvoice: old?.noInvoice ?? false,
    }
  })
}

/** A card going back to the model, so a spoken correction applies to it. */
export const toHeard = (d: Draft): HeardDraft => ({
  ref: d.id,
  type: d.type,
  project: d.project,
  category: d.category,
  item: d.item,
  contractor: d.contractor,
  no_contractor: d.noContractor,
  bank: d.bank,
  custody: d.custody,
  amount: Number(d.amount) || 0,
  date: d.date,
  notes: d.notes,
})

/** What still stops this card from being saved (same rules as the entry forms); empty when it is ready. */
export function missingOf(d: Draft, owner = false): string[] {
  const missing: string[] = []
  const value = Number(d.amount)
  if (needsCustody(d.type) && !d.custody) missing.push('العهدة')
  if (needsProject(d.type) && !d.project) missing.push('المشروع')
  if (needsCategory(d.type) && !d.category) missing.push('البند')
  if (d.type !== 'custody_payment' && !d.item.trim()) missing.push('البيان')
  if (needsBank(d.type) && !d.bank) missing.push('البنك')
  if (!Number.isFinite(value) || value <= 0) missing.push('المبلغ')
  if (!d.date) missing.push('التاريخ')
  if (needsProof(d.type, owner)) {
    if (needsCategory(d.type) && !d.contractor && !d.noContractor) missing.push('المقاول أو «بدون مقاول»')
    if (d.files.length === 0 && !d.noInvoice) missing.push('الفاتورة أو «بدون فاتورة»')
  }
  return missing
}
