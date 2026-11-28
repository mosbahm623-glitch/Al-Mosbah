import { FileText } from 'lucide-react'
import { openReport } from '../../lib/reports/preset'
import type { VoiceReport } from '../../lib/voice/report'

/** The report that was asked for: the app opens it from its own data, nothing of it goes to the model. */
export default function ReportOffer({ report, onOpen }: { report: VoiceReport; onOpen: () => void }) {
  const { preset, label } = report
  if (!preset) return <p className="msg msg-error">{label}</p>
  return (
    <div className="voice-mic">
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => {
          onOpen()
          openReport(preset)
        }}
      >
        <FileText size={20} aria-hidden="true" />
        افتح {label}
      </button>
    </div>
  )
}
