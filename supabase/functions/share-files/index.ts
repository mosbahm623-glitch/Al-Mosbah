import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Gives the client short-lived links to the invoice files of one entry. The share link (token) is the only key:
// it must be live (not revoked, not expired), and the entry must be an approved entry of that same project.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply({ error: 'method' }, 405)

  let body: { token?: string; seq?: number }
  try {
    body = await req.json()
  } catch {
    return reply({ error: 'bad_request' }, 400)
  }
  const token = body.token ?? ''
  const seq = body.seq
  if (!/^[0-9a-f]{64}$/.test(token) || !Number.isInteger(seq)) return reply({ error: 'bad_request' }, 400)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const share = await admin
    .from('project_shares')
    .select('project_id,revoked_at,expires_at')
    .eq('token', token)
    .maybeSingle()
  const s = share.data
  if (!s || s.revoked_at || (s.expires_at && new Date(s.expires_at) <= new Date())) return reply({ error: 'invalid' }, 404)

  const rows = await admin
    .from('entry_attachments')
    .select('path,file_name,created_at,entries!inner(project_id,seq,status)')
    .eq('entries.project_id', s.project_id)
    .eq('entries.seq', seq)
    .eq('entries.status', 'approved')
    .order('created_at')
  if (rows.error) return reply({ error: 'failed' }, 500)
  const list = rows.data ?? []
  if (!list.length) return reply({ files: [] })

  const signed = await admin.storage.from('invoices').createSignedUrls(
    list.map((r) => r.path),
    600,
  )
  if (signed.error) return reply({ error: 'failed' }, 500)
  const urls = new Map((signed.data ?? []).map((d) => [d.path, d.signedUrl]))
  const files = list.flatMap((r) => {
    const url = urls.get(r.path)
    return url ? [{ url, name: r.file_name, pdf: /\.pdf$/i.test(r.path) }] : []
  })
  return reply({ files })
})
