import { useCallback } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { fetchBankNames, fetchMyBankIds, type BankChoice } from '../lib/lookups'
import { useAsync } from '../lib/useAsync'
import BankPicker from './BankPicker'

/** The banks a custody payment may come out of: all of them for the admin, only his own list for an owner. */
export function useInstallmentBanks() {
  const { isOwner, profile } = useAuth()
  const banks = useAsync<BankChoice[]>(fetchBankNames)
  const ownerId = isOwner ? (profile?.id ?? null) : null
  const loadMine = useCallback(
    () => (ownerId ? fetchMyBankIds(ownerId) : Promise.resolve({ data: [] as string[], error: null })),
    [ownerId],
  )
  const mine = useAsync<string[]>(loadMine)
  const list = isOwner ? (banks.data ?? []).filter((b) => mine.data?.includes(b.id)) : (banks.data ?? [])
  return {
    list,
    failed: banks.failed || mine.failed,
    idOf: (name: string) => list.find((b) => b.name === name)?.id ?? null,
  }
}

/** Bank field of a custody payment: picked from the list, never typed in. */
export default function InstallmentBankField({
  value,
  onChange,
  banks,
}: {
  value: string
  onChange: (name: string) => void
  banks: BankChoice[]
}) {
  return (
    <div className="field">
      البنك / الحساب
      <BankPicker value={value} onChange={onChange} banks={banks} allowNew={false} placeholder="اختار البنك" />
    </div>
  )
}
