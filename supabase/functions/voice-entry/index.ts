import { createClient } from 'npm:@supabase/supabase-js@2'
import { generate } from './gemini.ts'
import { liveToken } from './live.ts'
import { ANSWER_SCHEMA, DEMO_CONTEXT, INSTRUCTIONS } from './prompt.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/** About two and a half minutes of 16 kHz mono WAV, as base64. */
const MAX_AUDIO = 7_000_000
const MAX_CONTEXT = 200_000

/** Trial mode: a card that names anything outside the invented lists is never passed on. */
function onlyDemoNames(draft: unknown) {
  const d = (draft ?? {}) as Record<string, unknown>
  const known = (value: unknown, list: string[]) => !value || list.includes(String(value))
  return (
    known(d.project, DEMO_CONTEXT.projects) &&
    known(
      d.category,
      DEMO_CONTEXT.categories.map((c) => c.name),
    ) &&
    known(d.contractor, DEMO_CONTEXT.contractors) &&
    known(d.bank, DEMO_CONTEXT.banks) &&
    known(d.custody, DEMO_CONTEXT.custodies)
  )
}

// Turns a voice recording into draft entries. It never writes to the database: the person reviews and saves in the app.
// Secrets: GEMINI_API_KEY (required) · VOICE_LIVE = "true" only once billing is on · GEMINI_MODEL (optional).
// {mode: "live"} hands out a one-use token for the live call (GEMINI_LIVE_MODEL optional).
// While VOICE_LIVE is not "true" the real lists are never sent to Google: invented ones replace them here.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply({ error: 'method' }, 405)

  const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  // verify_jwt (on by default) already checked the signature; read who the token belongs to
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

  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return reply({ error: 'no_key' }, 503)
  const live = Deno.env.get('VOICE_LIVE') === 'true'

  let body: { mode?: string; audio?: string; today?: string; context?: unknown; drafts?: unknown[] }
  try {
    body = await req.json()
  } catch {
    return reply({ error: 'bad_request' }, 400)
  }
  if (body.mode === 'live') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.today ?? '')) return reply({ error: 'bad_request' }, 400)
    const model = Deno.env.get('GEMINI_LIVE_MODEL') || 'gemini-3.1-flash-live-preview'
    const context = (live ? body.context : DEMO_CONTEXT) as object
    if (JSON.stringify(context ?? null).length > MAX_CONTEXT) return reply({ error: 'too_long' }, 413)
    const session = await liveToken(model, key, body.today!, context)
    if (session.error) return reply(session, session.error === 'quota' ? 429 : 502)
    return reply({ ...session, demo: !live })
  }
  if (typeof body.audio !== 'string' || !body.audio) return reply({ error: 'bad_request' }, 400)
  if (body.audio.length > MAX_AUDIO) return reply({ error: 'too_long' }, 413)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.today ?? '')) return reply({ error: 'bad_request' }, 400)

  const payload = JSON.stringify({
    today: body.today,
    ...((live ? body.context : DEMO_CONTEXT) as object),
    current_drafts: Array.isArray(body.drafts) ? body.drafts.filter((d) => live || onlyDemoNames(d)) : [],
  })
  if (payload.length > MAX_CONTEXT) return reply({ error: 'too_long' }, 413)

  const { res, failure } = await generate(
    Deno.env.get('GEMINI_MODEL') || 'gemini-3.8-flash',
    key,
    JSON.stringify({
      systemInstruction: { parts: [{ text: INSTRUCTIONS }] },
      contents: [
        { role: 'user', parts: [{ text: payload }, { inlineData: { mimeType: 'audio/wav', data: body.audio } }] },
      ],
      generationConfig: { responseMimeType: 'application/json', responseSchema: ANSWER_SCHEMA },
    }),
  )
  if (!res) return reply({ error: failure }, failure === 'quota' ? 429 : 502)
  try {
    const out = await res.json()
    const parts: { text?: string; thought?: boolean }[] = out.candidates[0].content.parts
    const answer = JSON.parse(
      parts
        .filter((p) => !p.thought)
        .map((p) => p.text ?? '')
        .join(''),
    )
    if (!Array.isArray(answer.drafts)) throw new Error('shape')
    return reply({
      demo: !live,
      reply: String(answer.reply ?? ''),
      drafts: answer.drafts.slice(0, 30),
      report: live ? answer.report : undefined,
    })
  } catch (e) {
    console.error('gemini answer unreadable', String(e))
    return reply({ error: 'ai_failed' }, 502)
  }
})
