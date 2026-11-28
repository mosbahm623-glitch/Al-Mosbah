import { useEffect, useRef } from 'react'

/** A report asked for from another page: which one, about whom, and for which days. */
export type ReportPreset = {
  type: 'journal' | 'period' | 'project' | 'advance' | 'contractor' | 'bank'
  /** the project / custody / contractor / bank; empty for the journal */
  id: string
  from: string
  to: string
}

/** Long enough for the reports page to load the first time, short enough not to surprise a later visit. */
const FRESH_MS = 10_000
let waiting: { preset: ReportPreset; at: number } | null = null
const listeners = new Set<(p: ReportPreset) => void>()

export function openReport(preset: ReportPreset) {
  waiting = { preset, at: Date.now() }
  listeners.forEach((apply) => apply(preset))
  window.location.hash = '#/reports'
}

/** For the reports page, whether it is already open in a tab or opening now. */
export function useReportPreset(apply: (preset: ReportPreset) => void) {
  const latest = useRef(apply)
  useEffect(() => {
    latest.current = apply
  })
  useEffect(() => {
    const listener = (p: ReportPreset) => latest.current(p)
    if (waiting && Date.now() - waiting.at < FRESH_MS) listener(waiting.preset)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])
}
