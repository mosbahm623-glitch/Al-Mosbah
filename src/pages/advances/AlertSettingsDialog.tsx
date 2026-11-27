import { useState, type FormEvent } from 'react'
import Dialog from '../../components/Dialog'
import FormActions from '../../components/FormActions'
import {
  alertPayload,
  fetchAlertSettings,
  saveAlertSettings,
  type AlertRecipients,
  type AlertRow,
  type AlertSettings,
} from '../../lib/advances/alerts'
import { money } from '../../lib/core/format'
import { useAsync } from '../../lib/core/useAsync'

const RECIPIENTS: { key: keyof AlertRecipients; label: string }[] = [
  { key: 'to_admin', label: 'الأدمن' },
  { key: 'to_holder', label: 'صاحب العهدة' },
  { key: 'to_owner', label: 'المالك' },
]

function AlertForm({ settings, onClose }: { settings: AlertSettings; onClose: () => void }) {
  const [to, setTo] = useState<AlertRecipients>(() => ({
    to_admin: settings.to_admin,
    to_holder: settings.to_holder,
    to_owner: settings.to_owner,
  }))
  const [rows, setRows] = useState<AlertRow[]>(() =>
    settings.advances.map((a) => ({
      id: a.id,
      enabled: a.enabled,
      limit: a.threshold === null ? '' : String(a.threshold),
    })),
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const change = (id: string, patch: Partial<AlertRow>) =>
    setRows((now) => now.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const payload = alertPayload(to, rows)
    if (!payload.rows) return setError(payload.error)
    setSaving(true)
    setError(null)
    const { error: err } = await saveAlertSettings(to, payload.rows)
    setSaving(false)
    if (err) return setError('ما اتحفظش، جرّب تاني')
    onClose()
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="dialog-form">
      <div className="msg-to">
        التنبيه يوصل لمين
        <div className="msg-to-list">
          {RECIPIENTS.map(({ key, label }) => (
            <label className="check" key={key}>
              <input type="checkbox" checked={to[key]} onChange={(e) => setTo({ ...to, [key]: e.target.checked })} />
              {label}
            </label>
          ))}
        </div>
      </div>
      <div className="msg-to">
        حد كل عهدة (ج.م)
        <div className="alert-list">
          {settings.advances.map((a) => {
            const row = rows.find((r) => r.id === a.id)
            if (!row) return null
            return (
              <div className="alert-row" key={a.id}>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => change(a.id, { enabled: e.target.checked })}
                  />
                  <span>
                    {a.holder_name}
                    <span className={`alert-balance small ${a.balance < 0 ? 'tone-text-err' : 'muted'}`}>
                      الرصيد {money(a.balance)}
                    </span>
                  </span>
                </label>
                <input
                  value={row.limit}
                  onChange={(e) => change(a.id, { limit: e.target.value })}
                  disabled={!row.enabled}
                  inputMode="decimal"
                  placeholder="الحد"
                  aria-label={`حد التنبيه لعهدة ${a.holder_name}`}
                />
              </div>
            )
          })}
          {settings.advances.length === 0 && <span className="muted small">مفيش عهد مفتوحة.</span>}
        </div>
      </div>
      <p className="muted small">
        التنبيه بيتبعت مرة لما الرصيد ينزل تحت الحد، ومرة لما يبقى بالسالب. الحفظ نفسه ما بيبعتش حاجة: العهدة اللي تحت
        الحد دلوقتي بتنبّه عند النزول الجاي.
      </p>
      {error && (
        <p className="msg msg-error" role="alert">
          {error}
        </p>
      )}
      <FormActions saving={saving} onClose={onClose} />
    </form>
  )
}

/** Admin only: who hears about a low custody balance, and each open custody's limit. */
export default function AlertSettingsDialog({ onClose }: { onClose: () => void }) {
  const { data, failed } = useAsync<AlertSettings>(fetchAlertSettings)
  return (
    <Dialog title="إعدادات تنبيه العهد" onClose={onClose}>
      {data ? (
        <AlertForm settings={data} onClose={onClose} />
      ) : failed ? (
        <p className="msg msg-error">مقدرناش نحمّل الإعدادات، جرّب تاني</p>
      ) : (
        <p className="muted">جارٍ التحميل...</p>
      )}
    </Dialog>
  )
}
