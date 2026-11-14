import { useCallback, useEffect, useMemo, useState } from 'react'
import { Camera, FileText, X } from 'lucide-react'
import {
  MAX_INVOICES,
  fetchAttachments,
  isPdf,
  removeInvoice,
  signedUrls,
  uploadInvoices,
  type Attachment,
} from '../lib/attachments'
import { useAsync } from '../lib/useAsync'

type Props = {
  /** the saved entry; without it the photos are only kept in `files` until the entry is saved */
  entryId?: string
  files: File[]
  onFiles: (files: File[]) => void
  /** may delete photos already stored on the entry */
  canRemove: boolean
  /** show the photos only (no adding) */
  readOnly?: boolean
}

/** Invoice photos of one entry: add (camera or gallery), see, and remove. */
export default function InvoiceField({ entryId, files, onFiles, canRemove, readOnly }: Props) {
  const load = useCallback(
    () => (entryId ? fetchAttachments(entryId) : Promise.resolve({ data: [], error: null })),
    [entryId],
  )
  const stored = useAsync<Attachment[]>(load)
  const saved = stored.data ?? []
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const paths = saved.map((a) => a.path).join('|')
  useEffect(() => {
    let active = true
    void signedUrls(paths ? paths.split('|') : []).then((u) => active && setUrls(u))
    return () => {
      active = false
    }
  }, [paths])

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

  const total = saved.length + files.length

  async function pick(list: FileList | null) {
    const picked = Array.from(list ?? []).filter((f) => f.type.startsWith('image/') || f.type === 'application/pdf')
    if (!picked.length) return
    const room = MAX_INVOICES - total
    if (room <= 0) return setError(`أقصى عدد ${MAX_INVOICES} ملفات للقيد`)
    const take = picked.slice(0, room)
    setError(picked.length > room ? `أقصى عدد ${MAX_INVOICES} ملفات للقيد` : null)
    if (!entryId) return onFiles([...files, ...take])
    setBusy(true)
    const failed = await uploadInvoices(entryId, take)
    setBusy(false)
    if (failed) setError(`${failed} ملف ما اترفعش، جرّب تاني`)
    stored.reload()
  }

  async function remove(a: Attachment) {
    setBusy(true)
    const ok = await removeInvoice(a)
    setBusy(false)
    if (!ok) return setError('الملف ما اتمسحش')
    stored.reload()
  }

  if (readOnly && total === 0) return null
  return (
    <div className="field span-2 inv-field">
      <span>الفواتير{total > 0 ? ` (${total})` : ''}</span>
      <div className="inv-grid">
        {saved.map((a) => (
          <div className="inv-thumb" key={a.id}>
            {urls[a.path] ? (
              <a
                href={urls[a.path]}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={isPdf(a) ? 'فتح الملف' : 'فتح الصورة'}
              >
                {isPdf(a) ? (
                  <span className="inv-file">
                    <FileText size={26} aria-hidden="true" />
                    <span>PDF</span>
                  </span>
                ) : (
                  <img src={urls[a.path]} alt={a.file_name ?? 'فاتورة'} loading="lazy" />
                )}
              </a>
            ) : (
              <span className="muted small">...</span>
            )}
            {canRemove && !readOnly && (
              <button
                type="button"
                className="inv-remove"
                aria-label="مسح الملف"
                disabled={busy}
                onClick={() => void remove(a)}
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
        {files.map((f, i) => (
          <div className="inv-thumb" key={`${f.name}-${i}`}>
            {isPdf({ type: f.type, file_name: f.name }) ? (
              <span className="inv-file">
                <FileText size={26} aria-hidden="true" />
                <span>PDF</span>
              </span>
            ) : (
              <img src={previews[i]} alt={f.name} />
            )}
            <button
              type="button"
              className="inv-remove"
              aria-label="شيل الملف"
              onClick={() => onFiles(files.filter((_, j) => j !== i))}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
        {!readOnly && total < MAX_INVOICES && (
          <label className={`inv-add${busy ? ' is-busy' : ''}`}>
            <Camera size={20} aria-hidden="true" />
            <span>{busy ? 'جارٍ الرفع...' : 'إضافة فاتورة'}</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              disabled={busy}
              onChange={(e) => {
                void pick(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
        )}
      </div>
      {error && <span className="msg msg-error">{error}</span>}
    </div>
  )
}
