// Builds the same Excel backup as the app's Backup page (Arabic sheets, names instead of codes),
// but reads the tables straight from Postgres so it can run unattended in GitHub Actions.
// Usage: SUPABASE_DB_URL=... npx tsx scripts/backup-excel.ts OUTPUT.xlsx
import pg from 'pg'
import { buildBackupSheets, type BackupData } from '../src/lib/export/backupSheets'
import { rawSheets } from '../src/lib/export/backupRaw'
import { buildBackupWorkbook } from '../src/lib/export/backupWorkbook'
import type { Row } from '../src/lib/export/backupTypes'

const url = process.env.SUPABASE_DB_URL
const out = process.argv[2]
if (!url || !out) {
  console.error('usage: SUPABASE_DB_URL=... tsx scripts/backup-excel.ts OUTPUT.xlsx')
  process.exit(2)
}

// dates stay "YYYY-MM-DD", timestamps become ISO strings (the app receives the same from the API)
const types = {
  getTypeParser: (oid: number, format?: 'text' | 'binary') => {
    if (oid === 1082) return (v: string) => v
    if (oid === 1114 || oid === 1184) return (v: string) => new Date(v).toISOString()
    return pg.types.getTypeParser(oid, format as 'text')
  },
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, types })
await client.connect()
await client.query('begin read only')
const read = async (table: string, order = 'id'): Promise<Row[]> =>
  (await client.query(`select * from public.${table} order by ${order}`)).rows as Row[]

// same columns and order as public.deleted_entries(), without its admin-only check
const trash = (
  await client.query(`
    select e.id, e.seq, e.kind, e.category, e.item, e.amount, e.entry_date, e.notes, e.rev, e.status_before_delete, e.deleted_at, e.delete_reason,
           p.name as project, c.name as contractor, d.full_name as deleted_by_name, u.full_name as created_by_name
    from public.entries e
    left join public.projects p on p.id = e.project_id left join public.contractors c on c.id = e.contractor_id
    left join public.profiles d on d.id = e.deleted_by left join public.profiles u on u.id = e.created_by
    where e.status = 'deleted' order by e.deleted_at desc`)
).rows as Row[]

const data: BackupData = {
  entries: await read('entries', 'seq'),
  projects: await read('projects'),
  categories: await read('expense_categories'),
  items: await read('expense_items'),
  contractors: await read('contractors'),
  ctx: await read('contractor_transactions'),
  banks: await read('bank_accounts'),
  transfers: await read('bank_transfers'),
  advances: await read('advances'),
  inst: await read('advance_installments'),
  rets: await read('advance_returns'),
  profiles: await read('profiles'),
  perms: await read('user_permissions', 'user_id'),
  access: await read('user_advance_access', 'user_id'),
  bankAccess: await read('user_bank_access', 'user_id'),
  history: await read('entry_history'),
  log: await read('backup_log'),
  counters: await read('entry_counters', 'year'),
  trash,
}
await client.query('rollback')
await client.end()

const { sheets, rowsTotal } = buildBackupSheets(data)
const wb = await buildBackupWorkbook([...sheets, ...rawSheets(data)])
await wb.xlsx.writeFile(out)
console.log(`${out}: ${sheets.length} app sheets + raw tables, ${rowsTotal} rows`)
