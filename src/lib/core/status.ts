/**
 * The states an entry or a custody payment goes through. Written once so a typo can't hide in a string and the
 * database rule "only approved counts" has one name in the code.
 */
export const STATUS = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  deleted: 'deleted',
} as const

export type EntryStatus = (typeof STATUS)[keyof typeof STATUS]
/** an entry that was not deleted */
export type LiveStatus = Exclude<EntryStatus, 'deleted'>
/** still waiting, or sent back */
export type OpenStatus = 'pending' | 'rejected'
/** what the admin decides */
export type DecisionStatus = 'approved' | 'rejected'
