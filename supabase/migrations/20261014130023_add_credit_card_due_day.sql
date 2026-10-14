alter table public.credit_cards
add column due_day smallint check (due_day between 1 and 31);
