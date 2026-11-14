import { supabase } from './supabase'

const BUCKET = 'invoices'
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_PDF_BYTES = 10 * 1024 * 1024
/** Most files (photos or PDFs) on one entry. */
export const MAX_INVOICES = 8

/** A PDF is stored as it is (no photo shrinking) and shown as a file icon instead of a picture. */
export const isPdf = (a: { path?: string | null; file_name?: string | null; type?: string }) =>
  a.type === 'application/pdf' || /\.pdf$/i.test(a.path ?? '') || /\.pdf$/i.test(a.file_name ?? '')

export type Attachment = { id: string; entry_id: string; path: string; file_name: string | null; created_at: string }

/** How many invoice photos an entry has (the lists load it together with the entry). */
export const invoiceCount = (e: { invoices?: { count: number }[] }) => e.invoices?.[0]?.count ?? 0

export const fetchAttachments = (entryId: string) =>
  supabase
    .from('entry_attachments')
    .select('id,entry_id,path,file_name,created_at')
    .eq('entry_id', entryId)
    .order('created_at')
    .returns<Attachment[]>()

/** One-hour links to the stored photos, keyed by their path. */
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {}
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
  return Object.fromEntries((data ?? []).flatMap((d) => (d.signedUrl && d.path ? [[d.path, d.signedUrl]] : [])))
}

/** A phone photo is several MB: scale it down and re-save it as JPEG (a few hundred KB). Falls back to the original. */
async function shrinkImage(file: File, maxSide = 1600, quality = 0.8): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', quality))
    return blob ?? file
  } catch {
    return file
  }
}

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

/** Stores one invoice photo or PDF on an entry. Returns an error message, or null when it went through. */
async function uploadInvoice(entryId: string, file: File): Promise<string | null> {
  const blob: Blob = file.type === 'application/pdf' ? file : await shrinkImage(file)
  if (!TYPES.includes(blob.type)) return 'نوع الملف مش مدعوم (صورة JPG أو PNG أو WebP، أو PDF)'
  if (blob.size > (blob.type === 'application/pdf' ? MAX_PDF_BYTES : MAX_IMAGE_BYTES)) return 'الملف كبير قوي'
  const path = `${entryId}/${crypto.randomUUID()}.${EXT[blob.type]}`
  const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type })
  if (up.error) return 'الملف ما اترفعش، جرّب تاني'
  const row = await supabase
    .from('entry_attachments')
    .insert({ entry_id: entryId, path, file_name: file.name.slice(0, 120) || null })
  if (row.error) {
    await supabase.storage.from(BUCKET).remove([path])
    return 'الملف ما اتسجّلش على القيد، جرّب تاني'
  }
  return null
}

/** Stores several photos one after the other. Returns how many failed. */
export async function uploadInvoices(entryId: string, files: File[]): Promise<number> {
  let failed = 0
  for (const f of files) if (await uploadInvoice(entryId, f)) failed += 1
  return failed
}

/** Removes the link first (row security decides who may), then the stored file. */
export async function removeInvoice(a: Attachment): Promise<boolean> {
  const { error, count } = await supabase.from('entry_attachments').delete({ count: 'exact' }).eq('id', a.id)
  if (error || !count) return false
  await supabase.storage.from(BUCKET).remove([a.path])
  return true
}
