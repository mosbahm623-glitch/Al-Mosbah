/** Fired on window when data may have changed (someone else saved, or the app came back to the screen). */
export const DATA_CHANGED = 'data-changed'
/** Fired after an approval decision, so the pending counter refreshes. */
export const APPROVALS_CHANGED = 'approvals-changed'

export const notifyApprovalsChanged = () => window.dispatchEvent(new Event(APPROVALS_CHANGED))
export const notifyDataChanged = () => window.dispatchEvent(new Event(DATA_CHANGED))
