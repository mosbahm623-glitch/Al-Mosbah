const nf = new Intl.NumberFormat('ar-EG-u-nu-latn', { maximumFractionDigits: 2 })
export const money = (n: number) => nf.format(n)

export const TYPE_LABEL = { finishing: 'تشطيب', furnishing: 'فرش' } as const
export type ProjectType = keyof typeof TYPE_LABEL

export const dateText = (iso: string) => iso.split('-').reverse().join('-')
/** The time an entry was recorded, as Cairo clock time: "3:05 م". Empty when there is no time. */
export const timeText = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Cairo' })
    .replace(/\s?AM$/, ' ص')
    .replace(/\s?PM$/, ' م')
}
/** DD-MM-YY, short enough for a phone table column. */
export const dateShort = (iso: string) => {
  const [y = '', m = '', d = ''] = iso.split('-')
  return `${d}-${m}-${y.slice(2)}`
}

/** Today as YYYY-MM-DD in the local time zone (what <input type="date"> and the database use). */
export const todayISO = () => new Date().toLocaleDateString('en-CA')
/** Today as DD-MM-YYYY, for printed headers. */
export const todayText = () => new Date().toLocaleDateString('en-GB').replaceAll('/', '-')

/** "من 01-10-2026 إلى 28-10-2026", or "كل الفترات" when both ends are open. */
export const periodText = (from: string, to: string) =>
  !from && !to
    ? 'كل الفترات'
    : `${from ? `من ${dateText(from)}` : ''}${from && to ? ' ' : ''}${to ? `إلى ${dateText(to)}` : ''}`

/** "2026-09" as "سبتمبر 2026". */
export const monthLabel = (ym: string) => {
  const [y = '', m = ''] = ym.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('ar-EG-u-nu-latn', { month: 'long', year: 'numeric' })
}
