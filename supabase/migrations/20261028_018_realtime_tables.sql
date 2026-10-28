-- Live updates: the app listens to changes of these tables (row security still decides who is told about what).
alter publication supabase_realtime add table public.entries, public.advance_installments, public.advance_returns, public.contractor_transactions, public.projects, public.advances, public.bank_accounts, public.contractors;
