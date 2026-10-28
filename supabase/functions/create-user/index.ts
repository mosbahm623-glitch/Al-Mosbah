import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Creates an account for an email the admin typed in. Only an active admin or owner may call it.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply({ error: 'method' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: userData } = await caller.auth.getUser()
  if (!userData.user) return reply({ error: 'unauthorized' }, 401)
  const { data: me } = await caller.from('profiles').select('role,is_active').eq('id', userData.user.id).maybeSingle()
  if (!me || !['admin', 'owner'].includes(me.role) || !me.is_active) return reply({ error: 'forbidden' }, 403)

  let body: { email?: string; password?: string; full_name?: string }
  try {
    body = await req.json()
  } catch {
    return reply({ error: 'bad_request' }, 400)
  }
  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''
  const fullName = (body.full_name ?? '').trim()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return reply({ error: 'invalid_email' }, 400)
  if (password.length < 8) return reply({ error: 'weak_password' }, 400)
  if (!fullName) return reply({ error: 'name_required' }, 400)

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const allow = await admin.rpc('add_allowed_email', { p_email: email })
  if (allow.error) return reply({ error: 'allowlist_failed' }, 500)

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (created.error || !created.data.user) {
    const exists = /already|registered|exists/i.test(created.error?.message ?? '')
    return reply({ error: exists ? 'email_exists' : 'create_failed' }, exists ? 409 : 500)
  }
  // accounts created by the admin are active right away, with no page access until he grants it
  await admin.from('profiles').update({ is_active: true, full_name: fullName }).eq('id', created.data.user.id)
  return reply({ id: created.data.user.id })
})
