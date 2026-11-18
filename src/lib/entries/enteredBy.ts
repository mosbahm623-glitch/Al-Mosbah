type HasEntrant = { creator?: { full_name: string | null } | null; entered_by_name?: string | null }

/** المدخل: the profile that recorded the entry, else the name copied from the old system; null when neither is known. */
export const enteredByOf = (e: HasEntrant): string | null => e.creator?.full_name ?? e.entered_by_name ?? null
