import { supabase } from './supabase'
import { notifyApprovalsChanged } from './approvals'

/** Fired (on window) whenever data may have changed: someone else saved something, or the app came back to the screen. */
export const DATA_CHANGED = 'data-changed'

const TABLES = ['entries', 'advance_installments', 'advance_returns', 'contractor_transactions', 'projects', 'advances', 'bank_accounts', 'contractors']

/** Listens to database changes and tells every open page to refresh itself. Returns the function that stops it. */
export function startLive(): () => void {
  let timer: number | undefined
  const fire = () => {
    window.clearTimeout(timer)
    // a burst of changes (e.g. approving many entries) makes a single refresh
    timer = window.setTimeout(() => {
      window.dispatchEvent(new Event(DATA_CHANGED))
      notifyApprovalsChanged()
    }, 400)
  }

  const channel = supabase.channel('live-data')
  for (const table of TABLES) channel.on('postgres_changes', { event: '*', schema: 'public', table }, fire)
  // after a reconnect, anything missed while offline is picked up by a refresh
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') fire()
  })

  // phones put the connection to sleep in the background: catch up when the app is opened again
  const onVisible = () => {
    if (document.visibilityState === 'visible') fire()
  }
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', fire)

  return () => {
    window.clearTimeout(timer)
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('online', fire)
    void supabase.removeChannel(channel)
  }
}
