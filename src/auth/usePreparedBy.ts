import { useAuth } from './AuthProvider'

/** Name of the signed-in user, shown as "أعدّه" in a report header. */
export const usePreparedBy = () => useAuth().profile?.full_name ?? ''
