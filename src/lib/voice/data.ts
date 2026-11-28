import { supabase } from '../supabase'
import { fetchAdvanceSummaries, addInstallment } from '../advances/advances'
import { fetchCategories, type Category } from '../entries/catalog'
import { fetchBankNames, fetchContractorNames } from '../core/lookups'
import { STATUS } from '../core/status'
import { fetchSummaries, pickableProjects } from '../projects/projects'
import { saveEntry, type SaveError } from '../offline/entrySave'
import { needsBank, needsCategory, type Draft, type Lists } from './drafts'

type Hint = { item: string; category: string; contractor: string | null }
export type VoiceData = Lists & { history: Hint[] }

type Past = { item: string; category: string; contractor: { name: string } | null }

/** The latest contractor and البند used with each البيان, newest first. */
export function hintsOf(rows: Past[], limit = 150): Hint[] {
  const seen = new Map<string, Hint>()
  for (const r of rows) {
    if (seen.size >= limit) break
    if (!seen.has(r.item))
      seen.set(r.item, { item: r.item, category: r.category, contractor: r.contractor?.name ?? null })
  }
  return [...seen.values()]
}

/** Everything a spoken entry is matched against. Null when any part failed: half a list would mislead the model. */
export async function fetchVoiceData(): Promise<{ data: VoiceData | null; error: unknown }> {
  const [projects, categories, contractors, banks, advances, past] = await Promise.all([
    fetchSummaries(),
    fetchCategories(),
    fetchContractorNames(),
    fetchBankNames(),
    fetchAdvanceSummaries(),
    supabase
      .from('entries')
      .select('item,category,contractor:contractors(name)')
      .eq('kind', 'expense')
      .eq('status', STATUS.approved)
      .not('item', 'is', null)
      .order('seq', { ascending: false })
      .limit(600)
      .returns<Past[]>(),
  ])
  const error = projects.error ?? categories.error ?? contractors.error ?? banks.error ?? advances.error ?? past.error
  if (error) return { data: null, error }
  return {
    data: {
      projects: pickableProjects(projects.data ?? []).map((p) => ({ id: p.id, name: p.name })),
      categories: (categories.data ?? []) as Category[],
      contractors: contractors.data ?? [],
      banks: banks.data ?? [],
      custodies: (advances.data ?? [])
        .filter((a) => a.status === 'open')
        .map((a) => ({ id: a.id, name: a.holder_name })),
      history: hintsOf(past.data ?? []),
    },
    error: null,
  }
}

/** Names only: no ids, amounts or balances leave the app. */
export const contextOf = (d: VoiceData) => ({
  projects: d.projects.map((p) => p.name),
  categories: d.categories.map((c) => ({ name: c.name, items: c.expense_items.slice(0, 40).map((i) => i.name) })),
  contractors: d.contractors.map((c) => c.name),
  banks: d.banks.map((b) => b.name),
  custodies: d.custodies.map((c) => c.name),
  history: d.history,
})

const ERRORS: Record<string, string> = {
  no_key: 'مفتاح Gemini لسه ما اتحطش في أسرار Supabase',
  busy: 'Gemini عليه ضغط دلوقتي، استنى دقيقة وجرّب تاني',
  quota: 'خلص حد الطلبات أو الرصيد في Gemini، جرّب بعد شوية',
  too_long: 'التسجيل طويل، قسّمه على مرتين',
  forbidden: 'التسجيل بالصوت للأدمن بس',
}

/** The function's own error code as a message to show. */
async function messageOf(error: unknown, fallback: string) {
  const response = (error as { context?: Response } | null)?.context
  const code = await response
    ?.json()
    .then((b: { error?: string }) => b.error ?? '')
    .catch(() => '')
  return ERRORS[code ?? ''] ?? fallback
}

/** A one-use pass for a live call. `demo` unless the server said otherwise: invented names, nothing to save. */
export async function askLive(today: string, data: VoiceData) {
  const res = await supabase.functions.invoke<{ token?: string; model?: string; demo?: boolean }>('voice-entry', {
    body: { mode: 'live', today, context: contextOf(data) },
  })
  const { token, model, demo } = res.data ?? {}
  if (!res.error && token && model) return { token, model, demo: demo !== false, error: undefined }
  const error = await messageOf(res.error, 'ما قدرتش أبدأ المكالمة، جرّب تاني')
  return { token: undefined, model: undefined, demo: true, error }
}

/** Is there already an entry (or custody payment) with the same money on the same day in the same place? */
export async function looksDuplicated(d: Draft, data: VoiceData): Promise<boolean> {
  const amount = Number(d.amount)
  if (d.type === 'custody_payment') {
    const advanceId = data.custodies.find((c) => c.name === d.custody)?.id
    if (!advanceId || !amount) return false
    const { data: rows } = await supabase
      .from('advance_installments')
      .select('id')
      .eq('advance_id', advanceId)
      .eq('paid_on', d.date)
      .eq('amount', amount)
      .neq('status', STATUS.rejected)
      .limit(1)
    return Boolean(rows?.length)
  }
  const projectId = data.projects.find((p) => p.name === d.project)?.id
  if (!projectId || !amount) return false
  const { data: rows } = await supabase
    .from('entries')
    .select('id')
    .eq('project_id', projectId)
    .eq('entry_date', d.date)
    .eq('amount', d.type === 'refund' ? -amount : amount)
    .eq('kind', d.type === 'income' ? 'income' : 'expense')
    .in('status', [STATUS.approved, STATUS.pending])
    .limit(1)
  return Boolean(rows?.length)
}

const SAVE_FAILED: Partial<Record<SaveError, string>> = {
  'bank-denied': 'البنك ده مش متاح',
  contractor: 'المقاول مش موجود في القايمة',
  device: 'مفيش نت والقيد ما اتحفظش على الجهاز',
}

export type Saved = { error: string } | { error: null; note: string }

/** Saves one reviewed card through the same path as the entry forms (same permissions, approval and offline queue). */
export async function saveDraft(d: Draft, data: VoiceData): Promise<Saved> {
  const id = (list: { id: string; name: string }[], name: string) => list.find((x) => x.name === name)?.id
  const advanceId = id(data.custodies, d.custody)
  if (d.type === 'custody_payment') {
    const bankId = id(data.banks, d.bank)
    if (!advanceId || !bankId) return { error: 'اختار العهدة والبنك' }
    const { error } = await addInstallment(advanceId, Number(d.amount), d.date, bankId)
    return error ? { error: 'ما اتحفظش، جرّب تاني' } : { error: null, note: 'اتسجلت الدفعة' }
  }
  const fromAdvance = d.type === 'custody_expense'
  if (fromAdvance && !advanceId) return { error: 'اختار العهدة' }
  const r = await saveEntry({
    advanceId: fromAdvance ? advanceId : undefined,
    fromAdvance,
    kind: d.type === 'income' ? 'income' : d.type === 'refund' ? 'refund' : 'expense',
    category: data.categories.find((c) => c.name === d.category),
    itemName: needsCategory(d.type) ? d.item : '',
    incomeLabel: d.type === 'income' ? d.item : '',
    contractorName: d.contractor,
    noContractor: d.noContractor,
    requirePhoto: fromAdvance,
    requireContractorChoice: fromAdvance,
    noInvoice: d.noInvoice,
    bankName: needsBank(d.type) ? d.bank : '',
    amount: d.amount,
    date: d.date,
    notes: d.notes,
    targetProject: id(data.projects, d.project) ?? '',
    editReason: '',
    files: d.files,
    contractors: data.contractors,
    banks: data.banks,
    banksOnly: true,
    newId: d.id,
  })
  if (r.status === 'error') return { error: SAVE_FAILED[r.error] ?? 'ما اتحفظش، راجع البيانات وجرّب تاني' }
  if (r.status === 'queued') return { error: null, note: 'اتحفظ على الجهاز وهيتبعت لما النت يرجع' }
  const photos = r.failedPhotos ? ` (${r.failedPhotos} صورة ما اترفعتش)` : ''
  return { error: null, note: `اتسجّل القيد رقم ${r.seq ?? ''}${photos}` }
}
