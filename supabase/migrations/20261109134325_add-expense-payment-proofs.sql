create table public.expense_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null unique references public.expenses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) between 1 and 500),
  original_file_name text not null check (char_length(original_file_name) between 1 and 255),
  content_type text not null check (content_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index expense_payment_proofs_user_id_idx on public.expense_payment_proofs (user_id);

alter table public.expense_payment_proofs enable row level security;
revoke all on public.expense_payment_proofs from anon, authenticated;
grant select, insert, update, delete on public.expense_payment_proofs to authenticated;

create policy "Users manage their own expense payment proofs"
on public.expense_payment_proofs
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create trigger set_expense_payment_proofs_updated_at
before update on public.expense_payment_proofs
for each row execute function private.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expense-payment-proofs',
  'expense-payment-proofs',
  false,
  5242880,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Users upload their own expense payment proof files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'expense-payment-proofs'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users download their own expense payment proof files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'expense-payment-proofs'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users delete their own expense payment proof files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'expense-payment-proofs'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
