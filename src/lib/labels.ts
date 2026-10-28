/** Status of an entry, as people read it. */
export const ENTRY_STATUS_LABEL: Record<string, string> = { pending: 'مستنّي موافقة', approved: 'معتمد', rejected: 'مرفوض', deleted: 'محذوف' }

/** What was done to an entry, as written in its history. */
export const HISTORY_ACTION_LABEL: Record<string, string> = { edit: 'تعديل', approve: 'موافقة', reject: 'رفض', delete: 'مسح', restore: 'استرجاع', hard_delete: 'مسح نهائي' }
