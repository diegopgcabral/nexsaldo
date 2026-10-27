create table public.credit_card_invoice_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null,
  invoice_month date not null check (extract(day from invoice_month) = 1),
  content text not null default '' check (char_length(content) <= 10000),
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint credit_card_invoice_notes_card_user_fkey
    foreign key (card_id, user_id)
    references public.credit_cards (id, user_id) on delete cascade
);

create index credit_card_invoice_notes_user_card_month_status_idx
on public.credit_card_invoice_notes (user_id, card_id, invoice_month, is_completed, updated_at desc);

alter table public.credit_card_invoice_notes enable row level security;
revoke all on public.credit_card_invoice_notes from anon, authenticated;
grant select, insert, update, delete on public.credit_card_invoice_notes to authenticated;

create policy "Users can view their own invoice notes"
on public.credit_card_invoice_notes for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own invoice notes"
on public.credit_card_invoice_notes for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own invoice notes"
on public.credit_card_invoice_notes for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own invoice notes"
on public.credit_card_invoice_notes for delete to authenticated
using ((select auth.uid()) = user_id);

create trigger set_credit_card_invoice_notes_updated_at
before update on public.credit_card_invoice_notes
for each row execute function private.set_updated_at();
