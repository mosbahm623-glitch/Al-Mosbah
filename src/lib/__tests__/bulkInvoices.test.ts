import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ uploadInvoices: vi.fn() }))
vi.mock('../entries/attachments', () => ({ MAX_INVOICES: 8, uploadInvoices: m.uploadInvoices }))

import { roomLeft, uploadPicks } from '../entries/bulkInvoices'

const file = (n: string) => new File(['x'], n)

describe('roomLeft', () => {
  it('is what is left under the 8-file limit, never below zero', () => {
    expect(roomLeft(0)).toBe(8)
    expect(roomLeft(5)).toBe(3)
    expect(roomLeft(9)).toBe(0)
  })
})

describe('uploadPicks', () => {
  beforeEach(() => m.uploadInvoices.mockReset())

  it('uploads every entry and reports each one with its failed count', async () => {
    m.uploadInvoices.mockResolvedValueOnce(0).mockResolvedValueOnce(1)
    const done: [string, number][] = []
    await uploadPicks(
      [
        { id: 'a', files: [file('1.jpg')], existing: 0 },
        { id: 'b', files: [file('2.jpg')], existing: 0 },
      ],
      (id, failed) => done.push([id, failed]),
    )
    expect(done.sort()).toEqual([
      ['a', 0],
      ['b', 1],
    ])
  })

  it('never goes over the file limit: the extra files count as failed and are not sent', async () => {
    m.uploadInvoices.mockResolvedValue(0)
    const done: [string, number][] = []
    await uploadPicks([{ id: 'a', files: [file('1'), file('2'), file('3')], existing: 7 }], (id, f) =>
      done.push([id, f]),
    )
    expect(m.uploadInvoices).toHaveBeenCalledWith('a', [expect.any(File)])
    expect(done).toEqual([['a', 2]])
  })

  it('a thrown upload counts all of that entry as failed and the others still go on', async () => {
    m.uploadInvoices.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(0)
    const done: [string, number][] = []
    await uploadPicks(
      [
        { id: 'a', files: [file('1'), file('2')], existing: 0 },
        { id: 'b', files: [file('3')], existing: 0 },
      ],
      (id, f) => done.push([id, f]),
      1,
    )
    expect(done).toEqual([
      ['a', 2],
      ['b', 0],
    ])
  })
})
