import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Pager from '../Pager'
import Progress from '../Progress'
import Segmented from '../Segmented'
import StatusChip, { EntryFlag, RejectReason } from '../StatusChip'

const html = (el: React.ReactElement) => renderToStaticMarkup(el)

describe('Pager', () => {
  it('renders nothing when everything fits on one page', () => {
    expect(html(<Pager page={1} pages={1} from={0} to={5} total={5} onChange={() => {}} />)).toBe('')
  })
  it('shows the range, marks the current page and disables the edge buttons', () => {
    const out = html(<Pager page={1} pages={3} from={0} to={20} total={50} onChange={() => {}} />)
    expect(out).toContain('1–20 من 50')
    expect(out).toContain('aria-current="page"')
    expect(out).toMatch(/aria-label="الصفحة السابقة" disabled/)
    expect(out).not.toMatch(/aria-label="الصفحة التالية" disabled/)
  })
  it('disables "next" on the last page', () => {
    const out = html(<Pager page={3} pages={3} from={40} to={50} total={50} onChange={() => {}} />)
    expect(out).toMatch(/aria-label="الصفحة التالية" disabled/)
  })
})

describe('Progress', () => {
  it('caps the bar at 100% and flags an overrun', () => {
    const out = html(<Progress percent={140} over />)
    expect(out).toContain('aria-valuenow="100"')
    expect(out).toContain('width:100%')
    expect(out).toContain('bar-over')
  })
  it('keeps the normal style under budget', () => {
    const out = html(<Progress percent={40} over={false} />)
    expect(out).toContain('width:40%')
    expect(out).not.toContain('bar-over')
  })
})

describe('Segmented', () => {
  const options = [
    { value: 'a', label: 'الأول' },
    { value: 'b', label: 'الثاني' },
  ] as const
  it('marks only the chosen option as pressed', () => {
    const out = html(<Segmented label="اختيار" value="b" options={options} onChange={() => {}} />)
    expect(out.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(out).toMatch(/class="seg-on" aria-pressed="true"[^>]*>الثاني/)
  })
})

describe('StatusChip', () => {
  it('uses the entry wording by default and the feminine wording for payments', () => {
    expect(html(<StatusChip status="approved" />)).toContain('معتمد<')
    expect(html(<StatusChip status="approved" kind="payment" />)).toContain('معتمدة')
  })
  it('uses the long wording for a waiting entry only when asked', () => {
    expect(html(<StatusChip status="pending" long />)).toContain('قيد الموافقة')
    expect(html(<StatusChip status="pending" />)).toContain('معلّق')
  })
  it('colours each status', () => {
    expect(html(<StatusChip status="rejected" />)).toContain('chip-err')
    expect(html(<StatusChip status="deleted" />)).toContain('chip-neutral')
  })
})

describe('RejectReason / EntryFlag', () => {
  it('shows nothing without a reason', () => {
    expect(html(<RejectReason reason={null} />)).toBe('')
  })
  it('shows the reason beside a rejected entry, and nothing for an approved one', () => {
    const rejected = html(<EntryFlag status="rejected" reason="الفاتورة ناقصة" />)
    expect(rejected).toContain('مرفوض')
    expect(rejected).toContain('سبب الرفض: الفاتورة ناقصة')
    expect(html(<EntryFlag status="approved" />)).toBe('')
  })
  it('escapes a hostile reason', () => {
    const out = html(<RejectReason reason={'<img src=x onerror=alert(1)>'} />)
    expect(out).not.toContain('<img')
    expect(out).toContain('&lt;img')
  })
})
