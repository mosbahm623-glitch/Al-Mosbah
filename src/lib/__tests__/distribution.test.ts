import { describe, expect, it } from 'vitest'
import { applyDistributions, distributedCents, freeCents, type Distribution } from '../contractors/distribution'

type Row = { id: string; amount: number; category: string }

const dist = (over: Partial<Distribution> = {}): Distribution => ({
  id: 'd1',
  project_id: 'p1',
  contractor_id: 'c1',
  created_at: '2026-11-23T10:00:00Z',
  contractor: { name: 'مؤمن' },
  items: [
    { id: 'i1', item: 'دهان', category: 'دهانات', amount: 35000, position: 0 },
    { id: 'i2', item: 'سباكة', category: 'سباكة', amount: 25000, position: 1 },
  ],
  entries: [
    { entry_id: 'e1', amount: 20000 },
    { entry_id: 'e2', amount: 30000 },
    { entry_id: 'e3', amount: 10000 },
  ],
  ...over,
})

const make = (base: Row, it: { id: string; category: string }, amount: number, d: Distribution): Row => ({
  ...base,
  id: `${d.id}:${it.id}`,
  category: it.category,
  amount,
})

const rows: Row[] = [
  { id: 'e1', amount: 20000, category: 'مقاولين' },
  { id: 'e2', amount: 30000, category: 'مقاولين' },
  { id: 'e3', amount: 10000, category: 'مقاولين' },
  { id: 'e4', amount: 500, category: 'نقل' },
]
const total = (xs: Row[]) => xs.reduce((s, r) => s + Math.round(r.amount * 100), 0) / 100

describe('applyDistributions', () => {
  it('shows the work instead of the payments and keeps the total', () => {
    const out = applyDistributions(rows, [dist()], make)
    expect(total(out)).toBe(total(rows))
    expect(out.filter((r) => r.category === 'مقاولين')).toEqual([])
    expect(out.find((r) => r.category === 'دهانات')?.amount).toBe(35000)
    expect(out.find((r) => r.category === 'سباكة')?.amount).toBe(25000)
    expect(out.find((r) => r.id === 'e4')?.amount).toBe(500)
  })

  it('leaves the rest of a payment as a payment when the work is smaller', () => {
    const d = dist({
      items: [{ id: 'i1', item: 'دهان', category: 'دهانات', amount: 50000, position: 0 }],
      entries: [
        { entry_id: 'e1', amount: 20000 },
        { entry_id: 'e2', amount: 30000 },
      ],
    })
    const out = applyDistributions(rows, [d], make)
    expect(total(out)).toBe(total(rows))
    expect(out.find((r) => r.id === 'e3')?.amount).toBe(10000)
    expect(out.find((r) => r.category === 'دهانات')?.amount).toBe(50000)
  })

  it('cuts the work by the same share when only some payments are in the period', () => {
    const inPeriod = rows.filter((r) => r.id !== 'e3')
    const out = applyDistributions(inPeriod, [dist()], make)
    expect(total(out)).toBe(total(inPeriod))
    const work = out.filter((r) => r.id.startsWith('d1:'))
    expect(work.reduce((s, r) => s + r.amount, 0)).toBe(50000)
  })

  it('never lets an amount go negative if a payment was lowered afterwards', () => {
    const lowered = rows.map((r) => (r.id === 'e2' ? { ...r, amount: 10000 } : r))
    const out = applyDistributions(lowered, [dist()], make)
    expect(out.every((r) => r.amount >= 0)).toBe(true)
    expect(total(out)).toBe(total(lowered))
  })

  it('does nothing without distributions', () => {
    expect(applyDistributions(rows, [], make)).toBe(rows)
  })
})

describe('free amount of a payment', () => {
  it('is the amount minus what was already spread', () => {
    const by = distributedCents([dist({ entries: [{ entry_id: 'e1', amount: 5000 }] })])
    expect(freeCents({ id: 'e1', amount: 20000 }, by)).toBe(1500000)
    expect(freeCents({ id: 'e2', amount: 30000 }, by)).toBe(3000000)
  })
})
