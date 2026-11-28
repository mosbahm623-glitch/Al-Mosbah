import type { ReportPreset } from '../reports/preset'
import type { Lists } from './drafts'

/** A report as the model heard it asked for. */
export type HeardReport = { kind?: string; name?: string; from?: string; to?: string }

export type VoiceReport = { preset: ReportPreset; label: string } | { preset: null; label: string }

const KINDS = {
  project: { list: 'projects', label: 'تقرير مشروع' },
  contractor: { list: 'contractors', label: 'كشف حساب مقاول' },
  bank: { list: 'banks', label: 'كشف حساب بنك' },
  custody: { list: 'custodies', label: 'كشف عهدة' },
} as const

const day = (value: string | undefined) => (/^\d{4}-\d{2}-\d{2}$/.test(value ?? '') ? value! : '')
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** The report to offer, only ever about a name the app knows. `preset` is null when it could not be matched. */
export function toReport(heard: HeardReport, lists: Lists): VoiceReport {
  let from = day(heard.from)
  let to = day(heard.to)
  if (from && to && from > to) [from, to] = [to, from]
  if (heard.kind === 'journal') {
    const label = from ? `اليومية ${from}` : 'يومية النهارده'
    return { preset: { type: 'journal', id: '', from, to: '' }, label }
  }
  const kind = KINDS[heard.kind as keyof typeof KINDS]
  if (!kind) return { preset: null, label: 'التقرير ده مش متاح بالصوت' }
  const found = lists[kind.list].find((x) => same(x.name, heard.name ?? ''))
  if (!found) return { preset: null, label: `${kind.label}: ما لقيتش «${heard.name ?? ''}» في القوايم` }
  const dated = Boolean(from || to)
  // a project report for chosen days is the period report of that project; a custody statement has no period
  const type = heard.kind === 'custody' ? 'advance' : heard.kind === 'project' && dated ? 'period' : heard.kind
  const period = type !== 'advance' && dated ? ` (${from || 'البداية'} ← ${to || 'النهارده'})` : ''
  const note = type === 'advance' && dated ? ' (كل الفترات)' : ''
  return {
    preset: { type: type as ReportPreset['type'], id: found.id, from, to },
    label: `${kind.label}: ${found.name}${period}${note}`,
  }
}
