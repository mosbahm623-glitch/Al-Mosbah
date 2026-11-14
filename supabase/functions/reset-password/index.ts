import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Sets a new temporary password for a user who forgot his. Only an active admin may call it. The user must choose his
// own password at his next sign-in (the same flag a brand-new account gets).
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply({ error: 'method' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  // the gateway already verified the token's signature and expiry (verify_jwt)
  let callerId = ''
  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (claims.role === 'authenticated' && typeof claims.sub === 'string') callerId = claims.sub
  } catch {
    callerId = ''
  }
  if (!callerId) return reply({ error: 'unauthorized' }, 401)
  const { data: me } = await caller.from('profiles').select('role,is_active').eq('id', callerId).maybeSingle()
  if (!me || me.role !== 'admin' || !me.is_active) return reply({ error: 'forbidden' }, 403)

  let body: { user_id?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return reply({ error: 'bad_request' }, 400)
  }
  const userId = body.user_id ?? ''
  const password = body.password ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return reply({ error: 'bad_request' }, 400)
  if (password.length < 8) return reply({ error: 'weak_password' }, 400)

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const target = await admin.from('profiles').select('id').eq('id', userId).maybeSingle()
  if (!target.data) return reply({ error: 'not_found' }, 404)

  const updated = await admin.auth.admin.updateUserById(userId, { password })
  if (updated.error) return reply({ error: 'reset_failed' }, 500)
  const flagged = await admin.from('profiles').update({ must_change_password: true }).eq('id', userId)
  if (flagged.error) return reply({ error: 'reset_failed' }, 500)
  return reply({ ok: true })
})
