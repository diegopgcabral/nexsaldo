create type public.investment_asset_class as enum (
  'FIXED_INCOME', 'STOCK', 'FII', 'US_ETF', 'CRYPTO'
);

create type public.investment_transaction_type as enum (
  'BUY',
  'SELL'
);

create table public.investment_institutions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  normalized_name text generated always as (upper(regexp_replace(btrim(name), '\s+', ' ', 'g'))) stored,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, normalized_name)
);

create table public.investment_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  institution_id uuid references public.investment_institutions (id) on delete set null,
  asset_class public.investment_asset_class not null,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  ticker text check (ticker is null or char_length(btrim(ticker)) between 1 and 30),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique nulls not distinct (user_id, asset_class, ticker)
);

create table public.investment_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_id uuid not null references public.investment_assets (id) on delete cascade,
  quantity numeric(20, 8) not null check (quantity > 0),
  invested_amount numeric(14, 2) not null check (invested_amount >= 0),
  current_amount numeric(14, 2) not null check (current_amount >= 0),
  maturity_date date,
  as_of_date date not null default current_date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, asset_id)
);

create table public.investment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_id uuid not null references public.investment_assets (id) on delete cascade,
  institution_id uuid references public.investment_institutions (id) on delete set null,
  transaction_date date not null,
  transaction_type public.investment_transaction_type not null,
  trade_code text not null check (char_length(btrim(trade_code)) between 1 and 30),
  quantity numeric(20, 8) not null check (quantity > 0),
  unit_price numeric(14, 6) not null check (unit_price >= 0),
  total_amount numeric(14, 2) not null check (total_amount >= 0),
  source_hash text not null check (char_length(source_hash) = 64),
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, source_hash)
);

create index investment_institutions_user_name_idx
  on public.investment_institutions (user_id, name);
create index investment_assets_user_class_name_idx
  on public.investment_assets (user_id, asset_class, name);
create index investment_positions_user_asset_idx
  on public.investment_positions (user_id, asset_id);
create index investment_transactions_user_date_idx
  on public.investment_transactions (user_id, transaction_date desc);
create index investment_transactions_asset_date_idx
  on public.investment_transactions (asset_id, transaction_date desc);

alter table public.investment_institutions enable row level security;
alter table public.investment_assets enable row level security;
alter table public.investment_positions enable row level security;
alter table public.investment_transactions enable row level security;
revoke all on public.investment_institutions, public.investment_assets from anon, authenticated;
revoke all on public.investment_positions from anon, authenticated;
revoke all on public.investment_transactions from anon, authenticated;
grant select, insert, update, delete on public.investment_institutions, public.investment_assets, public.investment_positions to authenticated;
grant select, insert, update, delete on public.investment_transactions to authenticated;

create policy "Users manage own investment institutions" on public.investment_institutions
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own investment assets" on public.investment_assets
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own investment positions" on public.investment_positions
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own investment transactions" on public.investment_transactions
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create trigger set_investment_institutions_updated_at before update on public.investment_institutions
  for each row execute function private.set_updated_at();
create trigger set_investment_assets_updated_at before update on public.investment_assets
  for each row execute function private.set_updated_at();
create trigger set_investment_positions_updated_at before update on public.investment_positions
  for each row execute function private.set_updated_at();
