/** Builds a WhatsApp share link (opens the app / web with the text ready; the user picks the contact and presses send). */
export function whatsappLink(text: string, phone?: string | null): string {
  const digits = (phone ?? '').replace(/\D/g, '')
  // Egyptian mobile written locally (01xxxxxxxxx) -> international (20 1xxxxxxxxx)
  const intl = digits.startsWith('01') && digits.length === 11 ? `20${digits.slice(1)}` : digits.startsWith('00') ? digits.slice(2) : digits
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`
}

/** A short plain-text summary of a report for sharing. */
export function reportSummaryText(title: string, lines: { label: string; value: string }[]): string {
  return [`*${title}* - المصباح`, ...lines.map((l) => `${l.label}: ${l.value}`)].join('\n')
}
