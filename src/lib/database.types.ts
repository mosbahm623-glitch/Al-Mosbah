// Generated from the Supabase schema (project kytaxbhajnmdstyiorus). Regenerate after every migration.
/* eslint-disable @typescript-eslint/no-explicit-any */

type Rel = { foreignKeyName: string; columns: string[]; isOneToOne: false; referencedRelation: string; referencedColumns: string[] }
type T<R, I, U, Rels extends Rel[] = []> = { Row: R; Insert: I; Update: U; Relationships: Rels }

export type Database = {
  public: {
    Tables: {
      notifications: T<
        { id: number; user_id: string; kind: string; title: string; body: string | null; url: string | null; entry_id: string | null; created_at: string; read_at: string | null },
        { id?: never; user_id: string; kind: string; title: string; body?: string | null; url?: string | null; entry_id?: string | null; created_at?: string; read_at?: string | null },
        { read_at?: string | null }
      >
      push_subscriptions: T<
        { id: number; user_id: string; endpoint: string; p256dh: string; auth: string; created_at: string },
        { id?: never; user_id: string; endpoint: string; p256dh: string; auth: string; created_at?: string },
        { endpoint?: string; p256dh?: string; auth?: string }
      >
      backup_log: T<
        { at: string; by: string | null; id: number; note: string | null },
        { at?: string; by?: string | null; id?: never; note?: string | null },
        { at?: string; by?: string | null; id?: never; note?: string | null }
      >
      advance_installments: T<
        { advance_id: string; amount: number; created_at: string; id: string; paid_on: string },
        { advance_id: string; amount: number; created_at?: string; id?: string; paid_on?: string },
        { advance_id?: string; amount?: number; created_at?: string; id?: string; paid_on?: string }
      >
      advance_returns: T<
        { advance_id: string; amount: number; created_at: string; id: string; notes: string | null; returned_on: string },
        { advance_id: string; amount: number; created_at?: string; id?: string; notes?: string | null; returned_on?: string },
        { advance_id?: string; amount?: number; created_at?: string; id?: string; notes?: string | null; returned_on?: string }
      >
      advances: T<
        { created_at: string; holder_name: string; id: string; notes: string | null; status: string },
        { created_at?: string; holder_name: string; id?: string; notes?: string | null; status?: string },
        { created_at?: string; holder_name?: string; id?: string; notes?: string | null; status?: string }
      >
      bank_accounts: T<
        { created_at: string; id: string; name: string; opening_balance: number },
        { created_at?: string; id?: string; name: string; opening_balance?: number },
        { created_at?: string; id?: string; name?: string; opening_balance?: number }
      >
      contractor_transactions: T<
        { amount: number; contractor_id: string; created_at: string; id: string; kind: string; notes: string | null; project_id: string | null; txn_date: string },
        { amount: number; contractor_id: string; created_at?: string; id?: string; kind: string; notes?: string | null; project_id?: string | null; txn_date?: string },
        { amount?: number; contractor_id?: string; created_at?: string; id?: string; kind?: string; notes?: string | null; project_id?: string | null; txn_date?: string }
      >
      contractors: T<
        { created_at: string; id: string; name: string },
        { created_at?: string; id?: string; name: string },
        { created_at?: string; id?: string; name?: string }
      >
      entries: T<
        {
          advance_id: string | null; amount: number; bank_id: string | null; category: string; contractor_id: string | null
          created_at: string; created_by: string | null; decided_at: string | null; decided_by: string | null
          entry_date: string; id: string; item: string | null; kind: string; notes: string | null
          project_id: string; seq: number; rev: number; status: string; deleted_at: string | null; deleted_by: string | null; status_before_delete: string | null; delete_reason: string | null
        },
        {
          advance_id?: string | null; amount: number; bank_id?: string | null; category: string; contractor_id?: string | null
          created_at?: string; created_by?: string | null; decided_at?: string | null; decided_by?: string | null
          entry_date?: string; id?: string; item?: string | null; kind: string; notes?: string | null
          project_id: string; seq?: never; rev?: never; status?: string; deleted_at?: never; deleted_by?: never; status_before_delete?: never; delete_reason?: never
        },
        {
          advance_id?: string | null; amount?: number; bank_id?: string | null; category?: string; contractor_id?: string | null
          created_at?: string; created_by?: string | null; decided_at?: string | null; decided_by?: string | null
          entry_date?: string; id?: string; item?: string | null; kind?: string; notes?: string | null
          project_id?: string; seq?: never; rev?: never; status?: string; deleted_at?: never; deleted_by?: never; status_before_delete?: never; delete_reason?: never
        }
      >
      expense_categories: T<
        { created_at: string; id: string; name: string },
        { created_at?: string; id?: string; name: string },
        { created_at?: string; id?: string; name?: string }
      >
      expense_items: T<
        { category_id: string; created_at: string; id: string; name: string },
        { category_id: string; created_at?: string; id?: string; name: string },
        { category_id?: string; created_at?: string; id?: string; name?: string },
        [{ foreignKeyName: 'expense_items_category_id_fkey'; columns: ['category_id']; isOneToOne: false; referencedRelation: 'expense_categories'; referencedColumns: ['id'] }]
      >
      profiles: T<
        { created_at: string; email: string | null; full_name: string | null; id: string; is_active: boolean; role: string },
        { created_at?: string; email?: string | null; full_name?: string | null; id: string; is_active?: boolean; role?: string },
        { created_at?: string; email?: string | null; full_name?: string | null; id?: string; is_active?: boolean; role?: string }
      >
      projects: T<
        { budget: number; created_at: string; id: string; name: string; status: string; type: string },
        { budget?: number; created_at?: string; id?: string; name: string; status?: string; type?: string },
        { budget?: number; created_at?: string; id?: string; name?: string; status?: string; type?: string }
      >
      user_advance_access: T<
        { advance_id: string; user_id: string },
        { advance_id: string; user_id: string },
        { advance_id?: string; user_id?: string }
      >
      user_permissions: T<
        { level: string; module: string; user_id: string },
        { level: string; module: string; user_id: string },
        { level?: string; module?: string; user_id?: string }
      >
    }
    Views: { [_ in never]: never }
    Functions: {
      advance_summaries: { Args: never; Returns: any }
      bank_movements: { Args: { p_bank: string }; Returns: any }
      bank_summaries: { Args: never; Returns: any }
      dashboard_summary: { Args: never; Returns: any }
      delete_entry: { Args: { p_id: string; p_rev: number; p_reason: string }; Returns: boolean }
      restore_entry: { Args: { p_id: string }; Returns: boolean }
      project_deleted_entries: { Args: { p_project: string }; Returns: any }
      deleted_entries: { Args: never; Returns: any }
      entry_history_of: { Args: { p_id: string }; Returns: any }
      project_summaries: { Args: never; Returns: any }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
