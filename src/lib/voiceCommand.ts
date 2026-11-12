/**
 * فهم أوامر المساعد الصوتي بقواعد ثابتة (من غير ذكاء اصطناعي ومن غير تكلفة).
 *   تسجيل:  «سجّل ٥٠٠ نقاشة على الجندي»، «سجّل وارد ١٠٠ ألف على العيادة»
 *   سؤال:   «كام صرفنا على العيادة؟»، «رصيد الجندي»، «كام الوارد»
 */

export type NamedProject = { id: string; name: string }

export type Command =
  | {
      intent: 'entry'
      kind: 'income' | 'expense'
      amount: number | null
      project: NamedProject | null
      text: string
      category: string
    }
  | { intent: 'query'; metric: 'income' | 'expenses' | 'balance' | 'all'; project: NamedProject | null }
  | { intent: 'open'; path: string; label: string }
  | { intent: 'close' }
  | { intent: 'approve'; project: NamedProject | null }
  | { intent: 'unknown' }

const INDIC = '٠١٢٣٤٥٦٧٨٩'
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹'

/** Arabic spelling variants and digit forms should not break a match. */
export function plain(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String(INDIC.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(PERSIAN.indexOf(d)))
    .replace(/٫/g, '.')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[؟?!,،.]/g, (c) => (c === '.' ? '.' : ' '))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const WORDS: Record<string, number> = { الفين: 2000, الف: 1000, مليون: 1_000_000, مليونين: 2_000_000 }

/** The first amount in the text: "٣٠ الف" → 30000, "500" → 500, "الفين" → 2000. Returns the text without it. */
export function takeAmount(t: string): { amount: number | null; rest: string } {
  const m = /(\d+(?:\.\d+)?)\s*(الف|مليون)?/.exec(t)
  if (m) {
    const base = Number(m[1])
    const mult = m[2] ? WORDS[m[2]] : 1
    return { amount: base * (mult ?? 1), rest: (t.slice(0, m.index) + ' ' + t.slice(m.index + m[0].length)).trim() }
  }
  const w = /(?:^|\s)(الفين|مليونين|الف|مليون)(?=\s|$)/.exec(t)
  if (w?.[1]) return { amount: WORDS[w[1]] ?? null, rest: t.replace(w[1], ' ').trim() }
  return { amount: null, rest: t }
}

const stem = (w: string) => w.replace(/^ال/, '')
const GENERIC = new Set(['مشروع', 'فيلا', 'شقه', 'برج'])
/** The distinctive words of a project name (no "ا/", no "مشروع"), without the leading "ال". */
const nameWords = (name: string) =>
  plain(name)
    .split(/[\s/]+/)
    .map(stem)
    .filter((w) => w.length >= 3 && !GENERIC.has(w))

/** The project the sentence talks about: the one with most of its name words in it; the longer name wins a tie. */
export function findProject(t: string, projects: NamedProject[]): NamedProject | null {
  const tokens = t.split(/\s+/).map(stem)
  let best: { p: NamedProject; score: number } | null = null
  for (const p of projects) {
    const words = nameWords(p.name)
    if (!words.length) continue
    const hit = words.filter((w) => tokens.includes(w)).length
    if (hit === 0 || hit / words.length < 0.5) continue
    const score = (hit / words.length) * 1000 + words.join('').length
    if (!best || score > best.score) best = { p, score }
  }
  return best?.p ?? null
}

const CURRENCY = /(?:^|\s)(جنيه|جنية|جنيها|ج\.?م?)(?=\s|$)/g
const FILLER = /(?:^|\s)(على|علي|ع|في|فى|ل|لـ|مشروع|بتاع|بتاعه|ده|دي)(?=\s|$)/g

const ENTRY = /^(سجل|اضف|ضيف|اكتب|دخل|قيد)(?=\s|$)/
const INCOME = /(?:^|\s)(وارد|ايراد|ايرادات|قبضت|استلمت|قبضنا|استلمنا|دخلنا)(?=\s|$)/
const EXPENSE = /(?:^|\s)(مصروف|صرفت|صرفنا|دفعت|دفعنا)(?=\s|$)/

/** Category (البند) names found in the text, longest first. */
function guessCategory(t: string, categories: string[]): string {
  const hit = categories
    .map((c) => ({ c, p: plain(c) }))
    .filter(({ p }) => p.length >= 2 && t.includes(p))
    .sort((a, b) => b.p.length - a.p.length)[0]
  return hit?.c ?? ''
}

const PAGES: [RegExp, string, string][] = [
  [/موافقات|موافقه/, 'approvals', 'الموافقات'],
  [/قيد سريع|تسجيل سريع/, 'quick-entry', 'تسجيل قيد سريع'],
  [/اخر القيود|آخر القيود|القيود الاخيره/, 'recent', 'آخر القيود'],
  [/مشاريع|المشاريع/, 'projects', 'المشاريع'],
  [/عهد|عهده/, 'advances', 'العهد'],
  [/بنوك|بنك/, 'banks', 'البنوك'],
  [/مقاول|مستحقات/, 'contractors', 'مستحقات المقاولين'],
  [/تقارير|تقرير|تصدير/, 'reports', 'التقارير'],
  [/لوحه|داشبورد|رئيسيه|الرئيسيه/, 'dashboard', 'لوحة التحكم'],
  [/بحث/, 'search', 'البحث'],
  [/اشعارات|اشعار/, 'notifications', 'الإشعارات'],
  [/مستخدمين|مستخدم/, 'users', 'المستخدمين'],
  [/نسخه احتياطيه|باك اب|backup/, 'backup', 'النسخة الاحتياطية'],
]

const OPEN = /^(افتح|فتح|روح|وديني|اعرض|ورنى|ورني)(?=\s|$)/
const APPROVE = /^(وافق|اعتمد|اوافق|موافقه)(?=\s|$)/
const CLOSE = /^(اقفل|قفل|اغلق|سكر|خلاص|كفايه)(?=\s|$)/

export function parseCommand(raw: string, projects: NamedProject[], categories: string[] = []): Command {
  const t = plain(raw)
  if (!t) return { intent: 'unknown' }
  const project = findProject(t, projects)

  if (CLOSE.test(t)) return { intent: 'close' }
  if (APPROVE.test(t)) return { intent: 'approve', project }
  if (OPEN.test(t)) {
    if (project) return { intent: 'open', path: `projects/${project.id}`, label: `مشروع ${project.name}` }
    const page = PAGES.find(([re]) => re.test(t))
    if (page) return { intent: 'open', path: page[1], label: page[2] }
    return { intent: 'unknown' }
  }

  if (ENTRY.test(t)) {
    const kind: 'income' | 'expense' = INCOME.test(t) && !EXPENSE.test(t) ? 'income' : 'expense'
    let rest = t.replace(ENTRY, ' ').replace(INCOME, ' ').replace(EXPENSE, ' ')
    const { amount, rest: noAmount } = takeAmount(rest)
    rest = noAmount.replace(CURRENCY, ' ')
    if (project) {
      const drop = new Set(nameWords(project.name))
      rest = rest
        .split(/\s+/)
        .filter((w) => !drop.has(stem(w)))
        .join(' ')
    }
    const text = rest.replace(FILLER, ' ').replace(/\s+/g, ' ').trim()
    return { intent: 'entry', kind, amount, project, text, category: guessCategory(t, categories) }
  }

  const asks = /(?:^|\s)(كام|كم|قد ايه|رصيد|باقي|فاضل|صافي|اجمالي|مصروف|مصاريف|وارد|ايراد|صرفنا|صرفت)(?=\s|$)/.test(t)
  if (!asks) return { intent: 'unknown' }
  const metric = /رصيد|باقي|فاضل|صافي/.test(t)
    ? 'balance'
    : /وارد|ايراد|قبضنا|اتحصل|دخل/.test(t)
      ? 'income'
      : /صرف|مصروف|مصاريف|دفعنا/.test(t)
        ? 'expenses'
        : 'all'
  return { intent: 'query', metric, project }
}
