/** One header cell of a table: the text it shows and how many columns it covers. */
export type HeadCell = { label: string; span: number }

/**
 * The label each body cell shows beside its value when a table is turned into cards on a phone.
 * `spans` is the column span of every cell in the row; a cell that covers several columns
 * (an empty-state message, a total) has no single column to name, so it gets no label.
 */
export function cellLabels(heads: HeadCell[], spans: number[]): string[] {
  const byColumn: string[] = []
  for (const h of heads) for (let i = 0; i < Math.max(1, h.span); i++) byColumn.push(h.label)
  let column = 0
  return spans.map((span) => {
    const label = span > 1 ? '' : (byColumn[column] ?? '')
    column += Math.max(1, span)
    return label
  })
}
