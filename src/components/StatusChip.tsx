type Status = 'pending' | 'approved' | 'rejected' | 'deleted'

// the same status reads the same everywhere; a custody payment is feminine in Arabic (دفعة)
const LABELS = {
  entry: { pending: 'معلّق', approved: 'معتمد', rejected: 'مرفوض', deleted: 'محذوف' },
  payment: { pending: 'مستنية الموافقة', approved: 'معتمدة', rejected: 'مرفوضة', deleted: 'محذوفة' },
} as const
const TONE = { pending: 'warn', approved: 'ok', rejected: 'err', deleted: 'neutral' } as const

type Props = {
  status: Status
  kind?: keyof typeof LABELS
  /** the wide-screen wording of a waiting entry: «قيد الموافقة» */
  long?: boolean
  className?: string
}

export default function StatusChip({ status, kind = 'entry', long = false, className = '' }: Props) {
  const label = long && status === 'pending' ? 'قيد الموافقة' : LABELS[kind][status]
  return <span className={`chip chip-${TONE[status]}${className ? ` ${className}` : ''}`}>{label}</span>
}

/** Why the admin sent it back, shown next to the status. */
export function RejectReason({ reason, prefix = 'سبب الرفض' }: { reason: string | null | undefined; prefix?: string }) {
  return reason ? (
    <span className="reject-reason">
      {prefix}: {reason}
    </span>
  ) : null
}

/** The waiting / rejected mark beside an entry's name on wide screens (phones get the status column instead). */
export function EntryFlag({ status, reason }: { status: string; reason?: string | null }) {
  if (status === 'pending')
    return (
      <>
        {' '}
        <StatusChip status="pending" long className="sm-hide" />
      </>
    )
  if (status === 'rejected')
    return (
      <>
        {' '}
        <StatusChip status="rejected" className="sm-hide" />
        <RejectReason reason={reason} />
      </>
    )
  return null
}
