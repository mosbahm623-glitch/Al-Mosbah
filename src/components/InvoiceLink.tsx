import { useState } from 'react'
import { Paperclip } from 'lucide-react'
import { invoiceCount } from '../lib/attachments'
import Dialog from './Dialog'
import InvoiceField from './InvoiceField'

type Props = { entry: { id: string; seq: number; invoices?: { count: number }[] } }

/** A paperclip with the number of invoice photos; opens them. Nothing is shown when there are none. */
export default function InvoiceLink({ entry }: Props) {
  const [open, setOpen] = useState(false)
  const count = invoiceCount(entry)
  if (!count) return null
  return (
    <>
      <button
        type="button"
        className="inv-link"
        aria-label={`صور فواتير القيد ${entry.seq} (${count})`}
        title="الفواتير"
        onClick={() => setOpen(true)}
      >
        <Paperclip size={14} aria-hidden="true" />
        {count}
      </button>
      {open && (
        <Dialog title={`فواتير القيد #${entry.seq}`} onClose={() => setOpen(false)}>
          <InvoiceField entryId={entry.id} files={[]} onFiles={() => undefined} canRemove={false} readOnly />
        </Dialog>
      )}
    </>
  )
}
