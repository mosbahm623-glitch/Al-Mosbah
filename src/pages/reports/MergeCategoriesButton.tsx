import { useState } from 'react'
import { Merge } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import type { Category } from '../../lib/entries/catalog'
import MergeCategoriesDialog from './MergeCategoriesDialog'

/** Admin only: opens the dialog that merges بنود written in more than one way. */
export default function MergeCategoriesButton({
  categories,
  onSaved,
}: {
  categories: Category[]
  onSaved: () => void
}) {
  const { isAdmin } = useAuth()
  const [open, setOpen] = useState(false)
  if (!isAdmin || categories.length < 2) return null
  return (
    <>
      <button className="btn btn-ghost btn-icon" onClick={() => setOpen(true)}>
        <Merge size={18} aria-hidden="true" />
        توحيد أسماء البنود
      </button>
      {open && <MergeCategoriesDialog categories={categories} onClose={() => setOpen(false)} onSaved={onSaved} />}
    </>
  )
}
