export type Row = Record<string, unknown>
export type Kind = 'text' | 'money' | 'date' | 'time' | 'int' | 'tech'
export type Col = { h: string; kind?: Kind; w?: number; get: (r: Row) => unknown }
export type Sheet = { name: string; cols: Col[]; rows: Row[]; tab?: string }

export const str = (v: unknown) => (v == null ? '' : String(v))
export const day = (v: unknown) => (typeof v === 'string' && v ? v.slice(0, 10) : '')
