import BackupPanel from '../components/BackupPanel'
import PageHead from '../components/PageHead'
import ResetPanel from '../components/ResetPanel'

export default function Backup() {
  return (
    <div className="page-stack">
      <PageHead title="النسخة الاحتياطية" />
      <BackupPanel />
      <ResetPanel />
    </div>
  )
}
