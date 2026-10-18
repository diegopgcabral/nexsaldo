create table public.credit_card_invoice_closures (
  card_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  invoice_month date not null check (extract(day from invoice_month) = 1),
  closed_at timestamptz not null default timezone('utc', now()),
  primary key (card_id, invoice_month),
  constraint credit_card_invoice_closures_card_user_fkey
    foreign key (card_id, user_id)
    references public.credit_cards (id, user_id) on delete restrict
);

create index credit_card_invoice_closures_user_id_idx
on public.credit_card_invoice_closures (user_id);

alter table public.credit_card_invoice_closures enable row level security;
revoke all on public.credit_card_invoice_closures from anon, authenticated;
grant select, insert on public.credit_card_invoice_closures to authenticated;

create policy "Users can view their own invoice closures"
on public.credit_card_invoice_closures for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can close their own invoices"
on public.credit_card_invoice_closures for insert to authenticated
with check ((select auth.uid()) = user_id);

create function private.prevent_closed_invoice_purchase_changes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_card_id uuid := coalesce(new.card_id, old.card_id);
  v_invoice_month date := coalesce(new.invoice_month, old.invoice_month);
begin
  perform 1
  from public.credit_cards
  where id = v_card_id and user_id = (select auth.uid())
  for key share;

  if tg_op in ('UPDATE', 'DELETE') and exists (
    select 1
    from public.credit_card_invoice_closures
    where card_id = old.card_id
      and invoice_month = old.invoice_month
      and user_id = (select auth.uid())
  ) then
    raise exception 'Invoice is closed';
  end if;

  if tg_op in ('INSERT', 'UPDATE') and exists (
    select 1
    from public.credit_card_invoice_closures
    where card_id = v_card_id
      and invoice_month = v_invoice_month
      and user_id = (select auth.uid())
  ) then
    raise exception 'Invoice is closed';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger prevent_closed_invoice_purchase_changes
before insert or update or delete on public.credit_card_purchases
for each row execute function private.prevent_closed_invoice_purchase_changes();

create function public.close_credit_card_invoice(
  p_card_id uuid,
  p_invoice_month date
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if p_invoice_month is null or extract(day from p_invoice_month) <> 1 then
    raise exception 'Invalid invoice month';
  end if;
  perform 1
  from public.credit_cards
  where id = p_card_id and user_id = v_user_id
  for update;
  if not found then
    raise exception 'Card not found';
  end if;

  insert into public.credit_card_invoice_closures (card_id, user_id, invoice_month)
  values (p_card_id, v_user_id, p_invoice_month)
  on conflict (card_id, invoice_month) do nothing;
end;
$$;

revoke all on function public.close_credit_card_invoice(uuid, date) from public, anon;
grant execute on function public.close_credit_card_invoice(uuid, date) to authenticated;

create function public.move_credit_card_purchase_to_next_invoice(
  p_purchase_id uuid
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_card_id uuid;
  v_invoice_month date;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  select card_id, invoice_month
  into v_card_id, v_invoice_month
  from public.credit_card_purchases
  where id = p_purchase_id and user_id = v_user_id
  for update;
  if not found then raise exception 'Purchase not found'; end if;

  update public.credit_card_purchases
  set invoice_month = (v_invoice_month + interval '1 month')::date
  where id = p_purchase_id and user_id = v_user_id;
end;
$$;

revoke all on function public.move_credit_card_purchase_to_next_invoice(uuid) from public, anon;
grant execute on function public.move_credit_card_purchase_to_next_invoice(uuid) to authenticated;
