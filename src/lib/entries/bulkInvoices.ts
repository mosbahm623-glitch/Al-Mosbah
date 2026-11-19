import { MAX_INVOICES, uploadInvoices } from './attachments'

/** The photos picked for one entry; `existing` is how many it already has. */
export type Pick = { id: string; files: File[]; existing: number }

/** How many more files the entry can take. */
export const roomLeft = (existing: number) => Math.max(0, MAX_INVOICES - existing)

/**
 * Uploads each entry's photos, a few entries at a time. `onDone` is called as every entry finishes, with how many
 * of its files failed (0 = all went through).
 */
export async function uploadPicks(picks: Pick[], onDone: (id: string, failed: number) => void, parallel = 3) {
  const queue = [...picks]
  const worker = async () => {
    for (let p = queue.shift(); p; p = queue.shift()) {
      const files = p.files.slice(0, roomLeft(p.existing))
      let failed = p.files.length - files.length
      try {
        failed += await uploadInvoices(p.id, files)
      } catch {
        failed += files.length
      }
      onDone(p.id, failed)
    }
  }
  await Promise.all(Array.from({ length: Math.min(parallel, picks.length) }, worker))
}
