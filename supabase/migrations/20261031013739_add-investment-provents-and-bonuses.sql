alter type public.investment_transaction_type add value if not exists 'BONUS';

create type public.investment_provent_type as enum (
  'DIVIDEND',
  'JCP',
  'INCOME'
);

create table public.investment_provents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_id uuid not null references public.investment_assets (id) on delete cascade,
  received_on date not null,
  provent_type public.investment_provent_type not null,
  amount numeric(14, 2) not null check (amount > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  source_hash text not null check (char_length(source_hash) = 64),
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, source_hash)
);

create index investment_provents_user_date_idx
  on public.investment_provents (user_id, received_on desc);

alter table public.investment_provents enable row level security;
revoke all on public.investment_provents from anon, authenticated;
grant select, insert, update, delete on public.investment_provents to authenticated;

create policy "Users manage own investment provents"
  on public.investment_provents
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
