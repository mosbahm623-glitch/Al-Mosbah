import { supabase } from '../supabase'
import { fetchPaged } from '../core/paged'
import { writeBackupWorkbook } from './backupWorkbook'
import { buildBackupSheets } from './backupSheets'
import type { Row } from './backupTypes'
import { read } from './backupRead'

/** Reads every table (the deleted entries too) and saves one tidy Excel file: Arabic sheets, names instead of codes. Logs the backup. */
export async function downloadBackup(userId: string): Promise<boolean> {
  const need = async (t: string, order = 'id') => fetchPaged<Row>((a, b) => read(t, order, a, b))
  const [
    entries,
    projects,
    categories,
    items,
    contractors,
    ctx,
    dueItems,
    dists,
    distItems,
    distEntries,
    banks,
    transfers,
    advances,
    inst,
    rets,
    profiles,
    perms,
    access,
    bankAccess,
    history,
    log,
    counters,
  ] = await Promise.all([
    need('entries', 'seq'),
    need('projects'),
    need('expense_categories'),
    need('expense_items'),
    need('contractors'),
    need('contractor_transactions'),
    need('contractor_due_items'),
    need('payment_distributions'),
    need('payment_distribution_items'),
    need('payment_distribution_entries'),
    need('bank_accounts'),
    need('bank_transfers'),
    need('advances'),
    need('advance_installments'),
    need('advance_returns'),
    need('profiles'),
    need('user_permissions', 'user_id'),
    need('user_advance_access', 'user_id'),
    need('user_bank_access', 'user_id'),
    need('entry_history'),
    need('backup_log'),
    need('entry_counters', 'year'),
  ])
  const trash = await supabase.rpc('deleted_entries')
  if (
    trash.error ||
    [
      entries,
      projects,
      categories,
      items,
      contractors,
      ctx,
      dueItems,
      dists,
      distItems,
      distEntries,
      banks,
      transfers,
      advances,
      inst,
      rets,
      profiles,
      perms,
      access,
      bankAccess,
      history,
      log,
      counters,
    ].some((x) => !x)
  )
    return false
  const T = (x: Row[] | null) => x as Row[]
  const { sheets, rowsTotal } = buildBackupSheets({
    entries: T(entries),
    projects: T(projects),
    categories: T(categories),
    items: T(items),
    contractors: T(contractors),
    ctx: T(ctx),
    dueItems: T(dueItems),
    dists: T(dists),
    distItems: T(distItems),
    distEntries: T(distEntries),
    banks: T(banks),
    transfers: T(transfers),
    advances: T(advances),
    inst: T(inst),
    rets: T(rets),
    profiles: T(profiles),
    perms: T(perms),
    access: T(access),
    bankAccess: T(bankAccess),
    history: T(history),
    log: T(log),
    counters: T(counters),
    trash: (trash.data ?? []) as Row[],
  })
  await writeBackupWorkbook(sheets)
  const { error } = await supabase.from('backup_log').insert({ by: userId, note: `${rowsTotal} صف` })
  return !error
}
