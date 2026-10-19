create table public.participant_manual_charges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  participant_id uuid not null,
  reference_month date not null check (extract(day from reference_month) = 1),
  description text not null check (char_length(btrim(description)) between 1 and 200),
  amount numeric(14, 2) not null check (amount > 0),
  due_on date,
  notes text check (notes is null or char_length(btrim(notes)) <= 500),
  created_at timestamptz not null default timezone('utc', now()),
  constraint participant_manual_charges_participant_user_fkey foreign key (participant_id, user_id)
    references public.credit_card_participants (id, user_id) on delete restrict
);

create index participant_manual_charges_user_participant_month_idx
on public.participant_manual_charges (user_id, participant_id, reference_month);

create table public.participant_statement_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  participant_id uuid not null,
  reference_month date not null check (extract(day from reference_month) = 1),
  amount numeric(14, 2) not null check (amount > 0),
  received_on date not null default current_date,
  notes text check (notes is null or char_length(btrim(notes)) <= 500),
  created_at timestamptz not null default timezone('utc', now()),
  constraint participant_statement_payments_participant_user_fkey foreign key (participant_id, user_id)
    references public.credit_card_participants (id, user_id) on delete restrict
);

create index participant_statement_payments_user_participant_month_idx
on public.participant_statement_payments (user_id, participant_id, reference_month);

alter table public.participant_manual_charges enable row level security;
alter table public.participant_statement_payments enable row level security;

revoke all on public.participant_manual_charges, public.participant_statement_payments from anon, authenticated;
grant select, insert, update, delete on public.participant_manual_charges, public.participant_statement_payments to authenticated;

create policy "Users can manage their own manual participant charges"
on public.participant_manual_charges for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can manage their own participant statement payments"
on public.participant_statement_payments for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
