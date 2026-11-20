import { useCallback, useState } from 'react'
import { FileText, Paperclip } from 'lucide-react'
import { useAsync } from '../lib/core/useAsync'
import { fetchShareFiles, type ShareFile } from '../lib/projects/shares'
import Dialog from './Dialog'

type Props = { token: string; seq: number; count: number }

function Files({ token, seq }: { token: string; seq: number }) {
  const { data, loading } = useAsync<ShareFile[]>(
    useCallback(
      () => fetchShareFiles(token, seq).then((files) => ({ data: files, error: files ? null : 'failed' })),
      [token, seq],
    ),
  )
  const [big, setBig] = useState<ShareFile | null>(null)
  if (loading) return <p className="muted">جارٍ التحميل...</p>
  if (!data) return <p className="msg msg-error">مقدرناش نحمّل الفواتير، جرّب تاني</p>
  return (
    <>
      <div className="inv-grid">
        {data.map((f) => (
          <div className="inv-thumb" key={f.url}>
            {f.pdf ? (
              <a href={f.url} target="_blank" rel="noopener noreferrer" aria-label="فتح الملف">
                <span className="inv-file">
                  <FileText size={26} aria-hidden="true" />
                  <span>PDF</span>
                </span>
              </a>
            ) : (
              <button type="button" className="inv-open" aria-label="تكبير الصورة" onClick={() => setBig(f)}>
                <img src={f.url} alt={f.name ?? 'فاتورة'} loading="lazy" />
              </button>
            )}
          </div>
        ))}
      </div>
      {big && (
        <Dialog title="الفاتورة" wide onClose={() => setBig(null)}>
          <img className="inv-big" src={big.url} alt={big.name ?? 'فاتورة'} />
        </Dialog>
      )}
    </>
  )
}

/** The client's paperclip: the number of invoice files of an entry; opens them. Nothing when there are none. */
export default function SharedInvoiceLink({ token, seq, count }: Props) {
  const [open, setOpen] = useState(false)
  if (!count) return null
  return (
    <>
      <button
        type="button"
        className="inv-link"
        aria-label={`صور فواتير القيد ${seq} (${count})`}
        title="الفواتير"
        onClick={() => setOpen(true)}
      >
        <Paperclip size={14} aria-hidden="true" />
        {count}
      </button>
      {open && (
        <Dialog title="فواتير القيد" onClose={() => setOpen(false)}>
          <Files token={token} seq={seq} />
        </Dialog>
      )}
    </>
  )
}
