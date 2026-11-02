/** Save / cancel (and optionally delete with a second confirming click) row at the bottom of a dialog form. */
export default function FormActions({
  saving,
  onClose,
  onDelete,
  confirmingDelete = false,
}: {
  saving: boolean
  onClose: () => void
  onDelete?: () => void
  confirmingDelete?: boolean
}) {
  return (
    <div className="dialog-actions">
      <button className="btn" disabled={saving}>
        {saving ? 'جارٍ الحفظ...' : 'حفظ'}
      </button>
      <button type="button" className="btn btn-ghost" onClick={onClose}>
        إلغاء
      </button>
      {onDelete && (
        <button type="button" className="btn btn-danger" onClick={onDelete} disabled={saving}>
          {confirmingDelete ? 'تأكيد الحذف نهائياً' : 'حذف'}
        </button>
      )}
    </div>
  )
}
