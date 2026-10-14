create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  bank_name text not null check (char_length(btrim(bank_name)) between 1 and 80),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index credit_cards_user_name_key
on public.credit_cards (user_id, lower(btrim(name)));

alter table public.credit_cards enable row level security;
revoke all on table public.credit_cards from anon, authenticated;
grant select, insert, update, delete on table public.credit_cards to authenticated;

create policy "Users can view their own credit cards"
on public.credit_cards for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own credit cards"
on public.credit_cards for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own credit cards"
on public.credit_cards for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own credit cards"
on public.credit_cards for delete to authenticated
using ((select auth.uid()) = user_id);

create trigger set_credit_cards_updated_at
before update on public.credit_cards
for each row execute function private.set_updated_at();
