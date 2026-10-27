const nf = new Intl.NumberFormat('ar-EG-u-nu-latn', { maximumFractionDigits: 2 })
export const money = (n: number) => nf.format(n)

export const TYPE_LABEL = { finishing: 'تشطيب', furnishing: 'فرش' } as const
export type ProjectType = keyof typeof TYPE_LABEL

export const dateText = (iso: string) => iso.split('-').reverse().join('-')

/** Today as YYYY-MM-DD in the local time zone (what <input type="date"> and the database use). */
export const todayISO = () => new Date().toLocaleDateString('en-CA')
/** Today as DD-MM-YYYY, for printed headers. */
export const todayText = () => new Date().toLocaleDateString('en-GB').replaceAll('/', '-')
