/** لوجوهات البنوك المعروفة: ملفات ثابتة في التطبيق، فمبتتأثرش بإعادة الضبط. */
const RULES: { file: string; match: RegExp }[] = [
  { file: 'nbe.png', match: /الأهلي|الاهلي|al[\s-]*ahly|\bahly\b|\bnbe\b|national\s*bank/i },
  {
    file: 'cib-corp.png',
    match: /(cib|التجاري\s*الدولي).*(شركات|corporate)|(شركات|corporate).*(cib|التجاري\s*الدولي)/i,
  },
  { file: 'cib-icon.png', match: /التجاري\s*الدولي|\bcib\b|commercial\s*international/i },
  { file: 'cash.png', match: /كاش|\bcash\b/i },
]

/** لوجو البنك من اسمه، أو null لو مش من البنوك المعروفة. */
export function knownBankLogo(name: string): string | null {
  const hit = RULES.find((r) => r.match.test(name))
  return hit ? `${import.meta.env.BASE_URL}bank-logos/${hit.file}` : null
}
