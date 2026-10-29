alter type public.investment_asset_class add value if not exists 'BRAZILIAN_ETF';
alter type public.investment_asset_class add value if not exists 'BDR';
alter type public.investment_asset_class add value if not exists 'FUND';
alter type public.investment_asset_class add value if not exists 'PENSION';
alter type public.investment_asset_class add value if not exists 'CASH_BOX';

create table public.investment_product_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_class public.investment_asset_class not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, asset_class)
);

alter table public.investment_product_types enable row level security;
revoke all on public.investment_product_types from anon, authenticated;
grant select, insert, delete on public.investment_product_types to authenticated;

create policy "Users manage own investment product types"
  on public.investment_product_types
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
