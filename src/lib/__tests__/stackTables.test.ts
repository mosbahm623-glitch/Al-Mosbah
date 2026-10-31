import { describe, expect, it } from 'vitest'
import { cellLabels } from '../stackTables'

const heads = [
  { label: 'رقم القيد', span: 1 },
  { label: 'التاريخ', span: 1 },
  { label: 'المبلغ', span: 1 },
  { label: '', span: 1 },
]

describe('cellLabels', () => {
  it('gives each cell the title of its column', () => {
    expect(cellLabels(heads, [1, 1, 1, 1])).toEqual(['رقم القيد', 'التاريخ', 'المبلغ', ''])
  })

  it('leaves a cell that covers several columns without a label', () => {
    expect(cellLabels(heads, [4])).toEqual([''])
  })

  it('keeps the next cells aligned after a wide cell', () => {
    expect(cellLabels(heads, [2, 1, 1])).toEqual(['', 'المبلغ', ''])
  })

  it('counts a wide header cell as the columns it covers', () => {
    const wide = [
      { label: 'المشروع', span: 2 },
      { label: 'المبلغ', span: 1 },
    ]
    expect(cellLabels(wide, [1, 1, 1])).toEqual(['المشروع', 'المشروع', 'المبلغ'])
  })

  it('gives no label to cells past the last header', () => {
    expect(cellLabels(heads.slice(0, 2), [1, 1, 1])).toEqual(['رقم القيد', 'التاريخ', ''])
  })
})
