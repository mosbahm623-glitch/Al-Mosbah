// The live call: the app talks to Google directly with a one-use token, so the real key never leaves here.
// Everything the model is told is locked into the token. The caller picks the lists: invented ones in trial mode.
import { ANSWER_SCHEMA, INSTRUCTIONS, REPORT_SCHEMA } from './prompt.ts'

const CALL = `
إنت دلوقتي في مكالمة صوتية مباشرة. اتكلم بالعامية المصرية وبجمل قصيرة جدًا.
أول ما تفهم قيد أو تعديل أو إجابة، نادي set_drafts بالقايمة كاملة، وبعدها اسأل بصوتك عن أول حاجة ناقصة.
انت مبتحفظش أي حاجة: متقولش إن القيد اتسجل أو اتحفظ. لما القيد يكمل قوله يقفل المكالمة ويراجع الكارت ويدوس حفظ.`

const REPORT_CALL = `
لطلب تقرير نادي open_report، وقوله يدوس زرار فتح التقرير اللي ظهر على الشاشة.`

// in the call a report has its own function, so asking for one never touches the cards
const { report: _, ...DRAFT_FIELDS } = ANSWER_SCHEMA.properties
const DRAFTS_SCHEMA = { ...ANSWER_SCHEMA, properties: DRAFT_FIELDS }

const inMinutes = (n: number) => new Date(Date.now() + n * 60_000).toISOString()

function tokenRequest(model: string, today: string, context: object) {
  const text = `${INSTRUCTIONS}\n${CALL}${REPORT_CALL}\nالبيانات:\n${JSON.stringify({ today, ...context })}`
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
            { name: 'set_drafts', description: 'يعرض كروت القيود على الشاشة', parameters: DRAFTS_SCHEMA },
            { name: 'open_report', description: 'يعرض زرار يفتح التقرير المطلوب', parameters: REPORT_SCHEMA },
          ],
        },
      ],
      inputAudioTranscription: {},
    },
  }
}

export async function liveToken(model: string, key: string, today: string, context: object) {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(tokenRequest(model, today, context)),
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
