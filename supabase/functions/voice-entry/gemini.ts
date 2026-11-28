/** Free-tier models tried in order when the one before is overloaded, out of quota or gone. */
const FALLBACKS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite']
const MOVE_ON = [404, 429, 500, 503, 504]
const TOTAL_MS = 90_000
const ATTEMPT_MS = 45_000

export type Failure = 'busy' | 'quota' | 'ai_failed'

/** The first model that answers wins. A refused key or a bad request stops at once: another model would not help. */
export async function generate(first: string, key: string, body: string, pauseMs = 1500) {
  const deadline = Date.now() + TOTAL_MS
  // the preferred model gets a second chance: demand spikes are often over in a moment
  const models = [first, first, ...FALLBACKS.filter((m) => m !== first)]
  let failure: Failure = 'ai_failed'
  for (const [i, model] of models.entries()) {
    const left = deadline - Date.now()
    if (left <= 0) break
    if (i === 1) await new Promise((done) => setTimeout(done, pauseMs))
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body,
      signal: AbortSignal.timeout(Math.min(ATTEMPT_MS, left)),
    }).catch((e) => {
      console.error('gemini', model, 'no answer', String(e))
      return null
    })
    if (res?.ok) return { res, failure: null }
    if (!res) {
      failure = 'busy'
      continue
    }
    console.error('gemini', model, res.status, (await res.text()).slice(0, 500))
    if (!MOVE_ON.includes(res.status)) return { res: null, failure: 'ai_failed' as Failure }
    // a missing fallback says nothing new: keep the reason the earlier models gave
    if (res.status !== 404) failure = res.status === 429 ? 'quota' : 'busy'
  }
  return { res: null, failure }
}
