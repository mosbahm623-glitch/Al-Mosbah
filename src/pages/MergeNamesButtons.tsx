import { useState } from 'react'
import { Merge } from 'lucide-react'
import { fetchContractorSummaries, type ContractorRow } from '../lib/contractors/contractors'
import { useAsync } from '../lib/core/useAsync'
import { fetchCategories, type Category } from '../lib/entries/catalog'
import MergeDialog from './contractors/MergeDialog'
import MergeCategoriesDialog from './reports/MergeCategoriesDialog'

/** Admin pages only: the two buttons that merge بنود or مقاولين written in more than one way. */
export default function MergeNamesButtons() {
  const categories = useAsync<Category[]>(fetchCategories)
  const contractors = useAsync<ContractorRow[]>(fetchContractorSummaries)
  const [open, setOpen] = useState<'categories' | 'contractors' | null>(null)

  return (
    <>
      <button className="btn btn-ghost btn-icon" onClick={() => setOpen('categories')}>
        <Merge size={18} aria-hidden="true" />
        توحيد أسماء البنود
      </button>
      <button className="btn btn-ghost btn-icon" onClick={() => setOpen('contractors')}>
        <Merge size={18} aria-hidden="true" />
        توحيد أسماء المقاولين
      </button>
      {open === 'categories' && (
        <MergeCategoriesDialog
          categories={categories.data ?? []}
          onClose={() => setOpen(null)}
          onSaved={categories.reload}
        />
      )}
      {open === 'contractors' && (
        <MergeDialog contractors={contractors.data ?? []} onClose={() => setOpen(null)} onSaved={contractors.reload} />
      )}
    </>
  )
}
