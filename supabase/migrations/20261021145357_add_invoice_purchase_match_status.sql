alter table public.credit_card_purchases
add column invoice_matched boolean not null default false;

create or replace function public.move_credit_card_purchase_to_next_invoice(
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
  set invoice_month = (v_invoice_month + interval '1 month')::date,
      invoice_matched = false
  where id = p_purchase_id and user_id = v_user_id;
end;
$$;
