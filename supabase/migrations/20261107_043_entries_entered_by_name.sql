-- اسم المدخل للقيود المنسوخة من النظام القديم (مفيش لها حساب مستخدم)
alter table public.entries add column if not exists entered_by_name text;
