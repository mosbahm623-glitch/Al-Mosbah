import { Pencil, Undo2 } from 'lucide-react'
import type { AdvanceReturn } from '../../lib/advances/advances'
import { dateText, money } from '../../lib/core/format'

type Props = {
  returns: AdvanceReturn[] | null | undefined
  isStaff: boolean
  isAdmin: boolean
  /** removes both sides of a transfer between custodies */
  onCancelTransfer: (transferId: string) => void
  onAdd: () => void
  onEdit: (row: AdvanceReturn) => void
}

/** The money the holder gave back. */
export default function ReturnsPanel({ returns, isStaff, isAdmin, onCancelTransfer, onAdd, onEdit }: Props) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="section-title">رد العهدة</h2>
        {isStaff && (
          <button className="btn btn-ghost btn-icon" onClick={() => onAdd()}>
            <Undo2 size={18} aria-hidden="true" />
            رد عهدة
          </button>
        )}
      </div>
      {returns?.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>المبلغ</th>
                <th>ملاحظات</th>
                {isStaff && (
                  <th>
                    <span className="sr-only">إجراءات</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {returns.map((r) => (
                <tr key={r.id}>
                  <td className="num muted">{dateText(r.returned_on)}</td>
                  <td className="num strong">{money(r.amount)}</td>
                  <td className="muted">{r.notes}</td>
                  {isStaff && (
                    <td>
                      {r.transfer_id ? (
                        isAdmin && (
                          <button className="btn btn-ghost" onClick={() => onCancelTransfer(r.transfer_id as string)}>
                            إلغاء التحويل
                          </button>
                        )
                      ) : (
                        <button className="icon-btn" aria-label="تعديل المرتجع" onClick={() => onEdit(r)}>
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty muted">مفيش مرتجعات.</p>
      )}
    </section>
  )
}
