export default function Progress({ percent, over }: { percent: number; over: boolean }) {
  return (
    <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(percent, 100)}>
      <div className={over ? 'bar-fill bar-over' : 'bar-fill'} style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  )
}
