// The live call (trial only): the app talks to Google directly with a one-use token, so the real key never leaves here.
// Everything the model is told is locked into the token, and it is only ever told the invented lists.
import { ANSWER_SCHEMA, DEMO_CONTEXT, INSTRUCTIONS } from './prompt.ts'

const CALL = `
إنت دلوقتي في مكالمة صوتية مباشرة. اتكلم بالعامية المصرية وبجمل قصيرة جدًا.
أول ما تفهم قيد أو تعديل أو إجابة، نادي set_drafts بالقايمة كاملة، وبعدها اسأل بصوتك عن أول حاجة ناقصة.
انت مبتحفظش أي حاجة: متقولش إن القيد اتسجل أو اتحفظ.`

const inMinutes = (n: number) => new Date(Date.now() + n * 60_000).toISOString()

export function tokenRequest(model: string, today: string) {
  const text = `${INSTRUCTIONS}\n${CALL}\nالبيانات:\n${JSON.stringify({ today, ...DEMO_CONTEXT })}`
  return {
    uses: 1,
    expireTime: inMinutes(10),
    newSessionExpireTime: inMinutes(2),
    bidiGenerateContentSetup: {
      model: `models/${model}`,
      generationConfig: { responseModalities: ['AUDIO'] },
      systemInstruction: { parts: [{ text }] },
      tools: [
        {
          functionDeclarations: [
            { name: 'set_drafts', description: 'يعرض كروت القيود على الشاشة', parameters: ANSWER_SCHEMA },
          ],
        },
      ],
      inputAudioTranscription: {},
    },
  }
}

export async function liveToken(model: string, key: string, today: string) {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(tokenRequest(model, today)),
    signal: AbortSignal.timeout(15_000),
  }).catch((e) => {
    console.error('gemini live token', 'no answer', String(e))
    return null
  })
  if (!res) return { error: 'busy' as const }
  if (!res.ok) {
    console.error('gemini live token', model, res.status, (await res.text()).slice(0, 500))
    return { error: res.status === 429 ? ('quota' as const) : ('ai_failed' as const) }
  }
  const { name } = await res.json()
  return typeof name === 'string' ? { token: name, model } : { error: 'ai_failed' as const }
}
