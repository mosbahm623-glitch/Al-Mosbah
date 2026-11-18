const SHEET_NAME_MAX = 31

/**
 * An Excel-safe sheet name that is not taken yet: no \ / ? * [ ] :, no quote at either end, at most 31 characters.
 * A clash (the letter case does not matter) gets " (2)", " (3)" … Records the name in `taken`.
 */
export function sheetName(raw: string, taken: Set<string>): string {
  const base =
    raw
      .replace(/[\\/?*[\]:]/g, '-')
      .replace(/^'+|'+$/g, '')
      .trim()
      .slice(0, SHEET_NAME_MAX)
      .trim() || 'مشروع'
  let name = base
  for (let n = 2; taken.has(name.toLowerCase()); n++) {
    const suffix = ` (${n})`
    name = base.slice(0, SHEET_NAME_MAX - suffix.length).trim() + suffix
  }
  taken.add(name.toLowerCase())
  return name
}
