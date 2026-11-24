import PageHead from '../components/PageHead'
import MergeNamesButtons from './MergeNamesButtons'

/** Admin only: one place to merge بنود or مقاولين that are written in more than one way. */
export default function MergeNames() {
  return (
    <div className="page-stack">
      <PageHead
        title="توحيد الأسماء"
        note="لو بند أو مقاول مكتوب بأكتر من اسم، اختار الأسماء دي والاسم اللي يفضل، وكل القيود بتتنقل له. التوحيد مش بيترجّع."
        actions={<MergeNamesButtons />}
      />
    </div>
  )
}
