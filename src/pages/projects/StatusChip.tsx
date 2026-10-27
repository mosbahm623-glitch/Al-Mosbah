import { isOver, type ProjectSummary } from './types'

export default function StatusChip({ p }: { p: ProjectSummary }) {
  if (isOver(p)) return <span className="chip chip-err"><span className="dot" />تجاوز الميزانية</span>
  if (p.status === 'closed') return <span className="chip chip-neutral"><span className="dot" />مقفول</span>
  return <span className="chip chip-ok"><span className="dot" />نشط</span>
}
