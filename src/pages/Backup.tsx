import BackupPanel from '../components/BackupPanel'
import PageHead from '../components/PageHead'

export default function Backup() {
  return (
    <div className="page-stack">
      <PageHead title="النسخة الاحتياطية" />
      <BackupPanel />
    </div>
  )
}
