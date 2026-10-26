create or replace function private.sync_credit_card_purchase_expense()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_purchase_id uuid;
  v_description text;
  v_invoice_month date;
  v_owner_amount numeric;
begin
  if tg_table_name = 'credit_card_purchases' then
    v_purchase_id := coalesce(new.id, old.id);
  elsif tg_op = 'DELETE' then
    v_purchase_id := old.purchase_id;
  else
    v_purchase_id := new.purchase_id;
  end if;

  select purchase.description, purchase.invoice_month, split.amount
  into v_description, v_invoice_month, v_owner_amount
  from public.credit_card_purchases as purchase
  left join public.credit_card_purchase_splits as split
    on split.purchase_id = purchase.id and split.participant_id is null
  where purchase.id = v_purchase_id;

  if not found then return null; end if;
  if v_owner_amount is null then
    delete from public.expenses where credit_card_purchase_id = v_purchase_id;
  else
    update public.expenses
    set description = v_description,
        reference_amount = v_owner_amount,
        paid_amount = v_owner_amount,
        due_date = case
          when paid_at is not null then paid_at
          else v_invoice_month
        end,
        status = 'PAID'
    where credit_card_purchase_id = v_purchase_id;
  end if;
  return null;
end;
$$;

update public.expenses
set due_date = paid_at
where credit_card_purchase_id is not null
  and paid_at is not null
  and due_date is distinct from paid_at;
