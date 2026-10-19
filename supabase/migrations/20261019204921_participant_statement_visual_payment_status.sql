create table public.participant_statement_visual_payment_statuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  participant_id uuid not null,
  reference_month date not null check (extract(day from reference_month) = 1),
  confirmed_at timestamptz not null default timezone('utc', now()),
  constraint participant_statement_visual_payment_statuses_participant_user_fkey
    foreign key (participant_id, user_id)
    references public.credit_card_participants (id, user_id) on delete restrict,
  constraint participant_statement_visual_payment_statuses_user_participant_month_key
    unique (user_id, participant_id, reference_month)
);

create index participant_statement_visual_payment_statuses_user_month_idx
on public.participant_statement_visual_payment_statuses (user_id, reference_month);

alter table public.participant_statement_visual_payment_statuses enable row level security;

revoke all on public.participant_statement_visual_payment_statuses from anon, authenticated;
grant select, insert on public.participant_statement_visual_payment_statuses to authenticated;

create policy "Users can view their own statement visual payment statuses"
on public.participant_statement_visual_payment_statuses for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can confirm their own statement visual payment statuses"
on public.participant_statement_visual_payment_statuses for insert to authenticated
with check ((select auth.uid()) = user_id);
