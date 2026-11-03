import { Pencil, Plus } from 'lucide-react'
import StatusChip, { RejectReason } from '../../components/StatusChip'
import type { Installment } from '../../lib/advances'
import { dateText, money } from '../../lib/format'

type Props = {
  installments: Installment[] | null | undefined
  /** admin or owner: may record payments (the owner's wait for the admin) */
  isStaff: boolean
  /** only the admin may change a payment that is already approved */
  isAdmin: boolean
  onAdd: () => void
  onEdit: (row: Installment) => void
}

/** The money handed to the holder, each payment with its approval status. */
export default function InstallmentsPanel({ installments, isStaff, isAdmin, onAdd, onEdit }: Props) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="section-title">الدفعات</h2>
        {isStaff && (
          <button className="btn btn-icon" onClick={() => onAdd()}>
            <Plus size={18} aria-hidden="true" />
            دفعة جديدة
          </button>
        )}
      </div>
      {installments?.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>المبلغ</th>
                <th>الحالة</th>
                {isStaff && (
                  <th>
                    <span className="sr-only">إجراءات</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {installments.map((i) => (
                <tr key={i.id}>
                  <td className="num muted">{dateText(i.paid_on)}</td>
                  <td className="num strong">{money(i.amount)}</td>
                  <td>
                    <StatusChip status={i.status} kind="payment" />
                    {i.status === 'rejected' && <RejectReason reason={i.reject_reason} prefix="السبب" />}
                  </td>
                  {isStaff && (
                    <td>
                      {(isAdmin || i.status !== 'approved') && (
                        <button className="icon-btn" aria-label="تعديل الدفعة" onClick={() => onEdit(i)}>
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
        <p className="empty muted">مفيش دفعات لسه.</p>
      )}
    </section>
  )
}
