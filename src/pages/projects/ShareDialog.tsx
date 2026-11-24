import { useEffect, useState } from 'react'
import { Copy, Link2, Trash2 } from 'lucide-react'
import Dialog from '../../components/Dialog'
import {
  createShare,
  fetchActiveShare,
  revokeShares,
  shareUrl,
  updateShareOptions,
  type ProjectShare,
} from '../../lib/projects/shares'

type Props = { projectId: string; projectName: string; onClose: () => void }

/** Admin and owner: make, copy or cancel the read-only link a client uses to follow his project live. */
export default function ShareDialog({ projectId, projectName, onClose }: Props) {
  const [share, setShare] = useState<ProjectShare | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void fetchActiveShare(projectId).then(({ data, error: failed }) => {
      if (!active) return
      setShare(data)
      setError(failed ? 'مقدرناش نحمّل الرابط، جرّب تاني' : null)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [projectId])

  async function create() {
    setBusy(true)
    setError(null)
    const { data, error: err } = await createShare(projectId)
    setBusy(false)
    if (err || !data) return setError('ما اتعملش الرابط، جرّب تاني')
    setShare(data)
  }

  async function revoke() {
    setBusy(true)
    setError(null)
    const { error: err } = await revokeShares(projectId)
    setBusy(false)
    setConfirming(false)
    if (err) return setError('ما اتلغاش الرابط، جرّب تاني')
    setShare(null)
  }

  async function setOption(key: 'show_seq' | 'show_date', value: boolean) {
    if (!share) return
    setError(null)
    const { error: err } = await updateShareOptions(share.id, { [key]: value })
    if (err) return setError('ما اتحفظش الاختيار، جرّب تاني')
    setShare({ ...share, [key]: value })
  }

  async function copy() {
    if (!share) return
    try {
      // the preview can't know the project (the link is static), so the copied message names it above the link
      await navigator.clipboard.writeText(`متابعة مشروع ${projectName}\n${shareUrl(share.token)}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('ما قدرناش ننسخ، انسخ الرابط يدوي')
    }
  }

  return (
    <Dialog title="مشاركة المشروع مع العميل" subtitle={projectName} onClose={onClose}>
      <div className="dialog-form">
        <p className="muted small">
          العميل بيشوف المشروع لايف للقراءة بس: الإجماليات والبنود وقائمة القيود. مش بيشوف المقاول ولا البنك ولا اسم
          اللي سجّل ولا الملاحظات.
        </p>
        {loading && <p className="muted">جارٍ التحميل...</p>}
        {!loading && !share && (
          <button type="button" className="btn btn-icon" disabled={busy} onClick={() => void create()}>
            <Link2 size={18} aria-hidden="true" />
            إنشاء رابط للعميل
          </button>
        )}
        {share && (
          <>
            <label className="field">
              رابط العميل
              <input readOnly value={shareUrl(share.token)} dir="ltr" onFocus={(e) => e.currentTarget.select()} />
            </label>
            <div className="field">
              يظهر للعميل كمان
              <label className="check">
                <input
                  type="checkbox"
                  checked={share.show_seq}
                  onChange={(e) => void setOption('show_seq', e.target.checked)}
                />
                رقم القيد
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={share.show_date}
                  onChange={(e) => void setOption('show_date', e.target.checked)}
                />
                التاريخ
              </label>
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn btn-icon" onClick={() => void copy()}>
                <Copy size={18} aria-hidden="true" />
                {copied ? 'اتنسخ' : 'نسخ الرسالة والرابط'}
              </button>
              {!confirming ? (
                <button type="button" className="btn btn-ghost btn-icon" onClick={() => setConfirming(true)}>
                  <Trash2 size={18} aria-hidden="true" />
                  إلغاء الرابط
                </button>
              ) : (
                <button type="button" className="btn btn-danger btn-icon" disabled={busy} onClick={() => void revoke()}>
                  <Trash2 size={18} aria-hidden="true" />
                  تأكيد الإلغاء: العميل مش هيقدر يفتحه تاني
                </button>
              )}
            </div>
          </>
        )}
        {error && <p className="msg msg-error">{error}</p>}
      </div>
    </Dialog>
  )
}
