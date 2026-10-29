alter table public.investment_transactions
  alter column total_amount type numeric(20, 8)
  using total_amount::numeric(20, 8);

alter table public.investment_positions
  alter column invested_amount type numeric(20, 8)
  using invested_amount::numeric(20, 8),
  alter column current_amount type numeric(20, 8)
  using current_amount::numeric(20, 8);
