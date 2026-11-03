-- إعادة ضبط التطبيق (الأدمن بس): بتمسح كل بيانات التشغيل (القيود، المشاريع، العهد، البنوك، المقاولين، البنود، الإشعارات)
-- وبترجّع عدّاد أرقام القيود من الأول. بتسيب المستخدمين وصلاحياتهم واشتراكات الإشعارات وسجل النسخ الاحتياطية زي ما هي.
-- جدول واحد في أمر TRUNCATE واحد: لو أي جدول تاني لسه بيشاور على جدول من دول، الأمر بيفشل ومفيش حاجة بتتمسح (من غير CASCADE عن قصد).
create or replace function public.reset_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'admin only' using errcode = '42501';
  end if;

  truncate table
    public.entry_attachments,
    public.entry_history,
    public.entries,
    public.entry_counters,
    public.advance_installments,
    public.pending_advance_installments,
    public.advance_returns,
    public.user_advance_access,
    public.advances,
    public.contractor_transactions,
    public.contractor_settlements,
    public.contractors,
    public.bank_accounts,
    public.expense_items,
    public.expense_categories,
    public.notifications,
    private.project_low_balance,
    public.projects
  restart identity;

  -- the screens that are open on other devices refresh by themselves
  update public.data_pings set at = now() where id = 1;
end;
$$;

revoke execute on function public.reset_data() from public, anon;
grant execute on function public.reset_data() to authenticated;
