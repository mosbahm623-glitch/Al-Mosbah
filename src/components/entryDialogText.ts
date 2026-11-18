import type { SaveError } from '../lib/offline/entrySave'

/** The kinds the form offers. A refund is saved as an expense with a negative amount. */
export const KINDS = [
  { value: 'expense', label: 'مصروف' },
  { value: 'refund', label: 'مرتجع' },
  { value: 'income', label: 'وارد' },
] as const

/** What the person reads when saving fails, by reason. */
export const SAVE_ERRORS: Record<Exclude<SaveError, 'changed'>, string> = {
  category: 'اختار البند',
  item: 'اكتب البيان',
  income: 'اكتب بيان الوارد',
  amount: 'المبلغ لازم يكون أكبر من صفر',
  project: 'اختار المشروع',
  contractor: 'ما قدرناش نحفظ اسم المقاول، جرّب تاني',
  'contractor-choice': 'اختار المقاول، أو علّم على «بدون مقاول»',
  photo: 'ضيف صورة الفاتورة (أو سكرين شوت التحويل)، أو علّم على «بدون فاتورة»',
  bank: 'ما قدرناش نحفظ اسم البنك، جرّب تاني',
  'bank-required': 'اختار البنك',
  'bank-denied': 'البنك ده مش من البنوك المسموحة ليك. اختار من القايمة أو كلّم الأدمن',
  reason: 'اكتب سبب التعديل',
  'offline-edit': 'مفيش نت دلوقتي. التعديل محتاج اتصال، جرّب لما النت يرجع',
  failed: 'القيد ما اتحفظش، جرّب تاني',
  device: 'ما قدرناش نحفظ القيد على الجهاز',
}

export const CHANGED =
  'القيد ده اتغيّر (أو اتمسح) من حد تاني من وقت ما فتحته. اقفل النافذة وافتحه تاني عشان تشوف آخر نسخة وبعدين عدّل.'
