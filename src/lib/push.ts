import { supabase } from './supabase'

/** Public key of the push service (the private half stays in the database). */
const VAPID_PUBLIC = 'BIZtXtdBnTqLlpCa-QXkJ0UcaCr_LlWWpGXBDEwAGmBmpc_Ak-JKvra5zb0s2TseDFFK9R-haQ9cfjT9lnLAQD8'

export type PushState = 'unsupported' | 'blocked' | 'off' | 'on'

const toBytes = (b64: string) => {
  const raw = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export async function pushState(): Promise<PushState> {
  if (!supported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    return sub && Notification.permission === 'granted' ? 'on' : 'off'
  } catch {
    return 'off'
  }
}

/** Asks permission, subscribes this phone / browser and saves the subscription for the signed-in user. */
export async function enablePush(userId: string): Promise<PushState> {
  if (!supported()) return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off'
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(VAPID_PUBLIC) }))
  const j = sub.toJSON()
  if (!j.endpoint || !j.keys?.p256dh || !j.keys.auth) return 'off'
  await supabase.from('push_subscriptions').delete().eq('endpoint', j.endpoint)
  const { error } = await supabase
    .from('push_subscriptions')
    .insert({ user_id: userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth })
  return error ? 'off' : 'on'
}

export async function disablePush(): Promise<PushState> {
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      await sub.unsubscribe()
    }
  } catch {
    /* nothing to undo */
  }
  return 'off'
}
