type Props<T extends string> = {
  label: string
  value: T
  /** tone tints the button (green / amber / blue) so groups are told apart at a glance */
  options: readonly { value: T; label: string; tone?: 'ok' | 'warn' | 'blue' }[]
  onChange: (v: T) => void
}

export default function Segmented<T extends string>({ label, value, options, onChange }: Props<T>) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={[o.value === value ? 'seg-on' : '', o.tone ? `seg-${o.tone}` : ''].filter(Boolean).join(' ')}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
