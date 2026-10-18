create table public.credit_card_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null,
  participant_id uuid not null,
  invoice_month date not null check (extract(day from invoice_month) = 1),
  amount numeric(14, 2) not null check (amount > 0),
  received_on date not null default current_date,
  notes text check (notes is null or char_length(btrim(notes)) <= 500),
  created_at timestamptz not null default timezone('utc', now()),
  constraint credit_card_receipts_card_user_fkey foreign key (card_id, user_id)
    references public.credit_cards (id, user_id) on delete restrict,
  constraint credit_card_receipts_participant_user_fkey foreign key (participant_id, user_id)
    references public.credit_card_participants (id, user_id) on delete restrict
);

create index credit_card_receipts_user_month_card_idx
on public.credit_card_receipts (user_id, invoice_month, card_id, participant_id);

alter table public.credit_card_receipts enable row level security;
revoke all on public.credit_card_receipts from anon, authenticated;
grant select, insert on public.credit_card_receipts to authenticated;

create policy "Users can view their own card receipts"
on public.credit_card_receipts for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can register their own card receipts"
on public.credit_card_receipts for insert to authenticated
with check ((select auth.uid()) = user_id);

create function private.require_closed_invoice_for_receipt()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1 from public.credit_card_invoice_closures
    where card_id = new.card_id
      and invoice_month = new.invoice_month
      and user_id = (select auth.uid())
  ) then
    raise exception 'Invoice must be closed before registering receipts';
  end if;
  return new;
end;
$$;

create trigger require_closed_invoice_for_receipt
before insert on public.credit_card_receipts
for each row execute function private.require_closed_invoice_for_receipt();
