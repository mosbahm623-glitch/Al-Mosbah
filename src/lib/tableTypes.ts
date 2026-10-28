export type Tone = 'blue' | 'ok' | 'err' | 'warn' | 'neutral'
/** A summary card at the top of a report. */
export type Kpi = { label: string; value: string; tone?: Tone; neg?: boolean }

export type Cell = string | number | null
export type Col = {
  h: string
  kind?: 'text' | 'money' | 'date' | 'int'
  /** shows the cell as a coloured pill (screen and print); Excel ignores it */
  pill?: (v: Cell) => Tone | undefined
}
/** One table of a report: used by the screen grid, the printed table and the Excel file alike. */
export type Section = {
  heading?: string
  cols: Col[]
  rows: Cell[][]
  footer?: Cell[]
  empty?: string
  /** printed: the heading as a dark bar on top of the table instead of a plain title */
  bar?: boolean
}
