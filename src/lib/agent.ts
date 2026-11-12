import { supabase } from './supabase'
import { advanceBalance, fetchAdvanceSummaries } from './advances'
import { decide, fetchByStatus } from './approvals'
import { bankBalance, fetchBankSummaries } from './banks'
import { fetchCategories } from './catalog'
import { fetchContractorLedger, fetchContractorSummaries } from './contractors'
import { fetchBankNames, fetchContractorNames } from './lookups'
import { saveEntry, type SaveError } from './entrySave'
import { searchEntries } from './search'
import { fetchSummaries } from './projects'

/** One piece of a message to the model: text, a tool call, or a tool answer (kept exactly as the model sent it). */
type Part = Record<string, unknown>
export type Content = { role: 'user' | 'model'; parts: Part[] }
export type ToolCall = { name: string; args: Record<string, unknown>; id?: string }
type Result = Record<string, unknown>

/** One step of the model. `data.parts` is its answer: text and/or tool calls. */
export const askAgent = (contents: Content[], today: string) =>
  supabase.functions.invoke('agent', { body: { contents, today } })

/** Tools that change data: the person must confirm each one first. */
export const WRITE_TOOLS = new Set(['create_entry', 'approve_entries'])

export type AgentContext = { isAdmin: boolean; mayEnter: boolean; today: string; go: (path: string) => void }

const SAVE_ERRORS: Record<SaveError, string> = {
  category: 'البند مش موجود. اختار بند من list_categories.',
  item: 'لازم بيان للمصروف.',
  income: 'لازم وصف للوارد.',
  amount: 'المبلغ غلط.',
  project: 'المشروع مش موجود.',
  contractor: 'المقاول مش موجود في القايمة.',
  bank: 'البنك مش موجود في القايمة. اختار من list_banks.',
  'bank-denied': 'مش مسموح بالبنك ده للمستخدم.',
  'bank-required': 'لازم تحدد بنك (أو عهدة).',
  reason: 'لازم سبب.',
  'offline-edit': 'مفيش نت.',
  failed: 'القيد ما اتسجلش، جرّب تاني.',
  changed: 'القيد اتغيّر.',
  device: 'مشكلة في الجهاز.',
}

const PAGE =
  /^(dashboard|projects|advances|banks|contractors|approvals|reports|recent|search|notifications|users|backup|quick-entry)$/
const ITEM_PAGE = /^(projects|advances|banks|contractors)\/[0-9a-f-]{36}(\/report)?$/

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const rows = <T>(r: { data: T[] | null }) => r.data ?? []
const failed = (): Result => ({ error: 'ما قدرناش نحمّل البيانات.' })

/** Runs one tool with the person's own permissions and returns what the model needs to know. */
export async function runTool(call: ToolCall, ctx: AgentContext): Promise<Result> {
  const a = call.args
  switch (call.name) {
    case 'list_projects': {
      const r = await fetchSummaries()
      if (r.error) return failed()
      return {
        projects: rows(r).map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          budget: p.budget,
          income: p.income,
          expenses: p.expenses,
        })),
      }
    }
    case 'list_contractors': {
      const r = await fetchContractorSummaries()
      if (!r.data) return failed()
      return {
        contractors: r.data.map((c) => ({
          id: c.id,
          name: c.name,
          due: c.due,
          paid: c.paid,
          remaining: c.due - c.paid,
          spent: c.spent,
        })),
      }
    }
    case 'list_banks': {
      const r = await fetchBankSummaries()
      if (r.error) return failed()
      return { banks: rows(r).map((b) => ({ id: b.id, name: b.name, balance: bankBalance(b) })) }
    }
    case 'list_advances': {
      const r = await fetchAdvanceSummaries()
      if (r.error) return failed()
      return {
        advances: rows(r).map((x) => ({
          id: x.id,
          holder: x.holder_name,
          status: x.status,
          given: x.given,
          spent: x.spent,
          returned: x.returned,
          balance: advanceBalance(x),
        })),
      }
    }
    case 'list_categories': {
      const r = await fetchCategories()
      if (r.error) return failed()
      return {
        categories: rows(r).map((c) => ({ name: c.name, items: c.expense_items.map((i) => i.name).slice(0, 30) })),
      }
    }
    case 'contractor_account': {
      const led = await fetchContractorLedger(str(a.contractor_id))
      if (!led) return failed()
      const pid = str(a.project_id)
      const txns = led.txns.filter((t) => !pid || t.project_id === pid)
      const sum = (xs: number[]) => xs.reduce((t, n) => t + n, 0)
      const due = sum(txns.filter((t) => t.kind === 'due').map((t) => t.amount))
      const paid = sum(txns.filter((t) => t.kind === 'payment').map((t) => t.amount))
      const spent = pid ? [] : led.spent
      return {
        due,
        paid,
        remaining: due - paid,
        approved_spent_total: sum(spent.map((e) => e.amount)),
        approved_spent_note: pid ? 'غير متاح لمشروع محدد' : undefined,
      }
    }
    case 'search_entries': {
      const r = await searchEntries(str(a.query))
      if (!r.data) return failed()
      return {
        total: r.data.length,
        entries: r.data.slice(0, 15).map((e) => ({
          seq: e.seq,
          project: e.project?.name,
          kind: e.kind,
          category: e.category,
          item: e.item,
          amount: e.amount,
          date: e.entry_date,
          status: e.status,
          contractor: e.contractor?.name,
        })),
      }
    }
    case 'pending_entries': {
      const r = await fetchByStatus('pending')
      if (r.error) return failed()
      const pid = str(a.project_id)
      const list = rows(r).filter((e) => !pid || e.project_id === pid)
      return {
        count: list.length,
        total: list.reduce((t, e) => t + e.amount, 0),
        entries: list.slice(0, 40).map((e) => ({
          id: e.id,
          seq: e.seq,
          project: e.project?.name,
          kind: e.kind,
          category: e.category,
          item: e.item,
          amount: e.amount,
          by: e.entered_by_name ?? e.creator?.full_name,
        })),
      }
    }
    case 'open_page': {
      const path = str(a.path).replace(/^#?\/?/, '')
      if (!PAGE.test(path) && !ITEM_PAGE.test(path)) return { error: 'المسار ده مش موجود.' }
      ctx.go(path)
      return { ok: true }
    }
    case 'create_entry': {
      if (!ctx.mayEnter) return { error: 'المستخدم ده مالوش صلاحية تسجيل قيود.' }
      const kind = a.kind === 'income' ? 'income' : 'expense'
      const [cats, people, banks] = await Promise.all([fetchCategories(), fetchContractorNames(), fetchBankNames()])
      const category = rows(cats).find((c) => c.name === str(a.category))
      const advanceId = str(a.advance_id)
      const out = await saveEntry({
        kind,
        category,
        itemName: str(a.item),
        incomeLabel: str(a.item),
        contractorName: str(a.contractor),
        bankName: str(a.bank),
        amount: String(a.amount ?? ''),
        date: str(a.date) || ctx.today,
        notes: str(a.notes),
        targetProject: str(a.project_id),
        editReason: '',
        files: [],
        fromAdvance: advanceId !== '',
        advanceId: advanceId || undefined,
        contractors: rows(people),
        banks: rows(banks),
        banksOnly: true,
        newId: crypto.randomUUID(),
      })
      if (out.status === 'error') return { error: SAVE_ERRORS[out.error] }
      if (out.status === 'queued') return { ok: true, note: 'مفيش نت، القيد هيتبعت لوحده بعدين.' }
      return { ok: true, seq: out.seq, note: 'القيد اتسجّل وبيستنى الموافقة.' }
    }
    case 'approve_entries': {
      if (!ctx.isAdmin) return { error: 'الموافقة للأدمن بس.' }
      const ids = Array.isArray(a.entry_ids) ? a.entry_ids.map(String) : []
      const pending = rows(await fetchByStatus('pending')).filter((e) => ids.includes(e.id))
      if (!pending.length) return { error: 'القيود دي مش مستنية موافقة.' }
      const r = await decide(
        pending.map((e) => ({ id: e.id, rev: e.rev })),
        'approved',
      )
      return { approved: r.done, changed_meanwhile: r.skipped, failed: r.failed }
    }
    default:
      return { error: `أداة مش معروفة: ${call.name}` }
  }
}

/** A plain-words line for the confirmation card of a tool that changes data. */
export async function describeWrite(call: ToolCall, projectNames: Map<string, string>): Promise<string> {
  const a = call.args
  if (call.name === 'approve_entries') {
    const ids = Array.isArray(a.entry_ids) ? a.entry_ids.map(String) : []
    const list = rows(await fetchByStatus('pending')).filter((e) => ids.includes(e.id))
    const total = list.reduce((t, e) => t + e.amount, 0)
    return `الموافقة على ${list.length} قيد بإجمالي ${total.toLocaleString('en-US')} ج.م`
  }
  const where = projectNames.get(str(a.project_id)) ?? 'مشروع غير معروف'
  const what = a.kind === 'income' ? 'وارد' : 'مصروف'
  const bits = [
    str(a.category),
    str(a.item),
    str(a.contractor) && `مقاول: ${str(a.contractor)}`,
    str(a.bank) && `بنك: ${str(a.bank)}`,
    str(a.advance_id) && 'من عهدة',
  ].filter(Boolean)
  return `تسجيل ${what} ${Number(a.amount).toLocaleString('en-US')} ج.م على ${where}\n${bits.join(' · ')}`
}
