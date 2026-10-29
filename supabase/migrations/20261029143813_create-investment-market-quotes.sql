create table public.investment_market_quotes (
  asset_id uuid primary key references public.investment_assets (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  price numeric(20, 8) not null check (price >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  provider text not null check (char_length(btrim(provider)) between 1 and 50),
  quoted_at timestamptz not null
);

create index investment_market_quotes_user_quoted_idx
  on public.investment_market_quotes (user_id, quoted_at desc);

alter table public.investment_market_quotes enable row level security;
revoke all on public.investment_market_quotes from anon, authenticated;
grant select, insert, update, delete on public.investment_market_quotes to authenticated;

create policy "Users manage own investment market quotes"
  on public.investment_market_quotes
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
