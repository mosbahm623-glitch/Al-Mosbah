import { useState } from 'react'
import { Merge } from 'lucide-react'
import PageHead from '../components/PageHead'
import { useAsync } from '../lib/core/useAsync'
import { fetchCategories, type Category } from '../lib/entries/catalog'
import MergeCategoriesDialog from './reports/MergeCategoriesDialog'

/** Admin only: merge بنود that are written in more than one way. */
export default function MergeCategoryNames() {
  const categories = useAsync<Category[]>(fetchCategories)
  const [open, setOpen] = useState(false)
  return (
    <div className="page-stack">
      <PageHead
        title="توحيد أسماء البنود"
        note="لو بند مكتوب بأكتر من اسم، اختار الأسماء دي والاسم اللي يفضل، وكل القيود والتوزيعات بتتنقل له. التوحيد مش بيترجّع."
        actions={
          <button className="btn btn-icon" onClick={() => setOpen(true)}>
            <Merge size={18} aria-hidden="true" />
            توحيد
          </button>
        }
      />
      {open && (
        <MergeCategoriesDialog
          categories={categories.data ?? []}
          onClose={() => setOpen(false)}
          onSaved={categories.reload}
        />
      )}
    </div>
  )
}
