import { supabase } from '../supabase'

export type AlertRecipients = { to_admin: boolean; to_holder: boolean; to_owner: boolean }

type AdvanceAlert = {
  id: string
  holder_name: string
  balance: number
  enabled: boolean
  /** null until the admin sets one */
  threshold: number | null
}

export type AlertSettings = AlertRecipients & { advances: AdvanceAlert[] }

/** What is typed in the dialog: the limit stays text until saving. */
export type AlertRow = { id: string; enabled: boolean; limit: string }

/** Turns the typed rows into what the database saves, or says why they cannot be saved. */
export function alertPayload(recipients: AlertRecipients, rows: AlertRow[]) {
  const parsed = rows.map((r) => ({
    id: r.id,
    enabled: r.enabled,
    threshold: r.limit.trim() === '' ? null : Number(r.limit.replace(/,/g, '')),
  }))
  if (parsed.some((r) => r.enabled && r.threshold === null)) return { error: 'اكتب الحد لكل عهدة مفعّلة' }
  if (parsed.some((r) => r.threshold !== null && !(Number.isFinite(r.threshold) && r.threshold >= 0)))
    return { error: 'الحد لازم يكون رقم صفر أو أكتر' }
  const nobody = !recipients.to_admin && !recipients.to_holder && !recipients.to_owner
  if (nobody && parsed.some((r) => r.enabled)) return { error: 'اختار مين يوصله التنبيه' }
  return { rows: parsed }
}

/** Admin only. */
export const fetchAlertSettings = () => supabase.rpc('advance_alert_settings').returns<AlertSettings>()

/** Admin only. Saving sends no notification; it applies from the next movement. */
export const saveAlertSettings = (to: AlertRecipients, rows: NonNullable<ReturnType<typeof alertPayload>['rows']>) =>
  supabase.rpc('save_advance_alert_settings', {
    p_admin: to.to_admin,
    p_holder: to.to_holder,
    p_owner: to.to_owner,
    p_rows: rows,
  })
