import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

type Props = { title: string; subtitle?: string; wide?: boolean; onClose: () => void; children: ReactNode }

/** Modal built on the native <dialog>: focus trap and Esc come for free. */
export default function Dialog({ title, subtitle, wide, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el && !el.open) el.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      className={wide ? 'dialog dialog-wide' : 'dialog'}
      aria-labelledby="dialog-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close()
      }}
    >
      <div className="dialog-head">
        <div>
          {subtitle && <div className="muted small">{subtitle}</div>}
          <h2 id="dialog-title">{title}</h2>
        </div>
        <button type="button" className="icon-btn" aria-label="إغلاق" onClick={() => ref.current?.close()}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  )
}
