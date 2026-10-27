export default function ComingSoon({ title }: { title: string }) {
  return (
    <div className="page-stack">
      <h1 className="page-title">{title}</h1>
      <div className="card empty">
        <p>القسم ده لسه ما اتبناش.</p>
      </div>
    </div>
  )
}
