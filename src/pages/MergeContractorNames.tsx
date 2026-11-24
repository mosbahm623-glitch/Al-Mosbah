import { useState } from 'react'
import { Merge } from 'lucide-react'
import PageHead from '../components/PageHead'
import { fetchContractorSummaries, type ContractorRow } from '../lib/contractors/contractors'
import { useAsync } from '../lib/core/useAsync'
import MergeDialog from './contractors/MergeDialog'

/** Admin only: merge مقاولين that are written in more than one way. */
export default function MergeContractorNames() {
  const contractors = useAsync<ContractorRow[]>(fetchContractorSummaries)
  const [open, setOpen] = useState(false)
  return (
    <div className="page-stack">
      <PageHead
        title="توحيد أسماء المقاولين"
        note="لو مقاول مكتوب بأكتر من اسم، اختار الأسماء دي والاسم اللي يفضل، وكل قيوده ومستحقاته ودفعاته بتتنقل له. التوحيد مش بيترجّع."
        actions={
          <button className="btn btn-icon" onClick={() => setOpen(true)}>
            <Merge size={18} aria-hidden="true" />
            توحيد
          </button>
        }
      />
      {open && (
        <MergeDialog contractors={contractors.data ?? []} onClose={() => setOpen(false)} onSaved={contractors.reload} />
      )}
    </div>
  )
}
