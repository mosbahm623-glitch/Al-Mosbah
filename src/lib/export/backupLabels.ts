/** The Arabic words the backup shows instead of the codes stored in the database. */
export const KIND: Record<string, string> = { income: 'وارد', expense: 'مصروف', due: 'مستحق', payment: 'دفعة' }
export const STATUS: Record<string, string> = {
  pending: 'مستنّي موافقة',
  approved: 'معتمد',
  rejected: 'مرفوض',
  deleted: 'محذوف',
  open: 'مفتوحة',
  closed: 'مقفولة',
  active: 'نشط',
  done: 'منتهي',
}
export const ACTION: Record<string, string> = {
  edit: 'تعديل',
  approve: 'موافقة',
  reject: 'رفض',
  delete: 'مسح',
  restore: 'استرجاع',
  hard_delete: 'مسح نهائي',
}
export const ROLE: Record<string, string> = { admin: 'أدمن', user: 'مستخدم' }
export const LEVEL: Record<string, string> = { view: 'عرض', edit: 'تعديل' }
export const tr = (m: Record<string, string>, v: unknown) => (v == null ? '' : (m[String(v)] ?? String(v)))
