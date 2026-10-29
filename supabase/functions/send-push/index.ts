import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

// Called by the database (pg_net) when a notification row is created. Authenticates with a shared secret kept in the database.
// Deployed with verify_jwt = false (the shared secret is the check).
Deno.serve(async (req: Request) => {
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: cfg } = await sb.rpc('push_config')
  if (!cfg || !cfg.secret || req.headers.get('x-push-secret') !== cfg.secret) return new Response('forbidden', { status: 403 })

  const { user_id, title, body, url } = await req.json()
  webpush.setVapidDetails(cfg.subject, cfg.vapid_public, cfg.vapid_private)
  const { data: subs } = await sb.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id', user_id)
  const payload = JSON.stringify({ title, body, url })
  let sent = 0
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 })
      sent++
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      // the phone removed the permission: forget it
      if (code === 404 || code === 410) await sb.from('push_subscriptions').delete().eq('id', s.id)
    }
  }
  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } })
})
