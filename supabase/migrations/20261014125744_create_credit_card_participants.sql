create table public.credit_card_participants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index credit_card_participants_user_name_key
on public.credit_card_participants (user_id, lower(btrim(name)));

alter table public.credit_card_participants enable row level security;
revoke all on table public.credit_card_participants from anon, authenticated;
grant select, insert, update on table public.credit_card_participants to authenticated;

create policy "Users can view their own participants"
on public.credit_card_participants for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own participants"
on public.credit_card_participants for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own participants"
on public.credit_card_participants for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create trigger set_credit_card_participants_updated_at
before update on public.credit_card_participants
for each row execute function private.set_updated_at();
