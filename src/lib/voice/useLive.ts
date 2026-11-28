import { useCallback, useEffect, useRef, useState } from 'react'
import { askLive, type VoiceData } from './data'
import type { HeardDraft } from './drafts'
import { openAudio } from './liveAudio'
import type { HeardReport } from './report'

const ADDRESS =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained'
/** A forgotten call would eat the free quota. */
const MAX_CALL_MS = 5 * 60_000
const CONNECT_MS = 20_000

type Message = {
  setupComplete?: unknown
  serverContent?: {
    modelTurn?: { parts?: { inlineData?: { data?: string } }[] }
    inputTranscription?: { text?: string }
    interrupted?: boolean
    turnComplete?: boolean
  }
  toolCall?: {
    functionCalls?: { id: string; name: string; args?: HeardReport & { reply?: string; drafts?: HeardDraft[] } }[]
  }
}

export type CallState = 'off' | 'connecting' | 'on'

/** A live spoken conversation that fills the cards as it goes. It never saves anything. */
export function useLive(
  onDrafts: (drafts: HeardDraft[], reply: string, demo: boolean) => void,
  onReport: (report: HeardReport, demo: boolean) => void,
  onFail: (message: string) => void,
) {
  const [state, setState] = useState<CallState>('off')
  const [heard, setHeard] = useState('')
  const hangUp = useRef<(() => void) | null>(null)
  const handlers = useRef({ onDrafts, onReport, onFail })
  useEffect(() => {
    handlers.current = { onDrafts, onReport, onFail }
  })

  const stop = useCallback(() => hangUp.current?.(), [])

  const start = useCallback(async (today: string, data: VoiceData) => {
    if (hangUp.current) return
    let over = false
    let socket: WebSocket | null = null
    let audio: Awaited<ReturnType<typeof openAudio>> | null = null
    const timers: ReturnType<typeof setTimeout>[] = []
    const end = (message?: string) => {
      if (over) return
      over = true
      hangUp.current = null
      timers.forEach(clearTimeout)
      socket?.close()
      audio?.close()
      setState('off')
      if (message) handlers.current.onFail(message)
    }
    hangUp.current = () => end()
    setState('connecting')
    setHeard('')
    // the microphone and the pass are fetched together: the call starts as soon as the slower of the two is done
    const opening = openAudio().then(
      (opened) => (over ? opened.close() : (audio = opened), true),
      () => false,
    )
    const asking = askLive(today, data)
    if (!(await opening)) return end('مقدرتش أفتح المايك. اسمح للتطبيق يستخدمه من إعدادات المتصفح')
    const first = await asking
    if (over) return
    // a new sentence replaces the one shown, once the model finished answering the old one
    let fresh = true

    const connect = (session: typeof first, mayFallBack: boolean) => {
      if (!session.token) return end(session.error)
      const ws = new WebSocket(`${ADDRESS}?access_token=${encodeURIComponent(session.token)}`)
      socket = ws
      ws.binaryType = 'arraybuffer'
      const send = (message: unknown) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(message))
      let ready = false
      /** The call never opened: try the older model once, then give up. */
      const failed = async (message: string) => {
        clearTimeout(waiting)
        ws.onclose = ws.onmessage = null
        ws.close()
        if (!mayFallBack) return end(message)
        const again = await askLive(today, data, true)
        if (!over) connect(again, false)
      }
      const waiting = setTimeout(() => void failed('المكالمة ما بدأتش، جرّب تاني'), CONNECT_MS)
      timers.push(waiting)

      ws.onopen = () => send({ setup: { model: `models/${session.model}` } })
      ws.onclose = (e) => {
        const message = `المكالمة اتقطعت (${e.code}${e.reason ? `: ${e.reason}` : ''})`
        if (ready) end(message)
        else if (!over) void failed(message)
      }
      ws.onmessage = (e: MessageEvent<ArrayBuffer | string>) => {
        const m = JSON.parse(typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data)) as Message
        if (m.setupComplete) {
          ready = true
          clearTimeout(waiting)
          timers.push(setTimeout(() => end('المكالمة وصلت 5 دقايق وقفلت. ابدأ واحدة جديدة'), MAX_CALL_MS))
          audio
            ?.listen((data) => send({ realtimeInput: { audio: { data, mimeType: 'audio/pcm;rate=16000' } } }))
            .then(
              () => !over && setState('on'),
              () => end('المايك ما اشتغلش، جرّب تاني'),
            )
        }
        const content = m.serverContent
        if (content?.interrupted) audio?.hush()
        content?.modelTurn?.parts?.forEach((p) => p.inlineData?.data && audio?.play(p.inlineData.data))
        const text = content?.inputTranscription?.text
        if (text) {
          const restart = fresh
          fresh = false
          setHeard((before) => (restart ? text : before + text))
        }
        if (content?.turnComplete) fresh = true
        for (const call of m.toolCall?.functionCalls ?? []) {
          const cards = call.name === 'set_drafts' && Array.isArray(call.args?.drafts)
          const report = call.name === 'open_report' && Boolean(call.args?.kind)
          if (cards)
            handlers.current.onDrafts(call.args!.drafts!.slice(0, 30), String(call.args!.reply ?? ''), session.demo)
          if (report) handlers.current.onReport(call.args!, session.demo)
          const ok = cards || report
          send({
            toolResponse: {
              functionResponses: [{ id: call.id, name: call.name, response: { output: ok ? 'shown' : 'invalid' } }],
            },
          })
        }
      }
    }
    connect(first, true)
  }, [])

  useEffect(() => () => stop(), [stop])

  return { state, heard, start, stop }
}
