import type { AdvanceSummary } from '../../lib/advances'

export default function AdvanceChip({ status }: { status: AdvanceSummary['status'] }) {
  return status === 'open' ? (
    <span className="chip chip-ok">
      <span className="dot" />
      مفتوحة
    </span>
  ) : (
    <span className="chip chip-neutral">
      <span className="dot" />
      مقفولة
    </span>
  )
}
