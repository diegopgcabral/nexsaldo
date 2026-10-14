alter table public.credit_card_purchase_splits
add column paid_at timestamptz;

alter table public.expenses
add column credit_card_purchase_id uuid;

alter table public.expenses
add constraint expenses_credit_card_purchase_user_fkey
foreign key (credit_card_purchase_id, user_id)
references public.credit_card_purchases (id, user_id)
on delete cascade;

alter table public.expenses
add constraint expenses_credit_card_purchase_id_key unique (credit_card_purchase_id);

create or replace function public.save_credit_card_purchase(
  p_id uuid, p_card_id uuid, p_description text, p_amount numeric,
  p_purchased_on date, p_invoice_month date, p_splits jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_count integer;
  v_sum numeric;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if p_description is null or char_length(btrim(p_description)) not between 1 and 160
     or p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2)
     or p_purchased_on is null or p_invoice_month is null
     or extract(day from p_invoice_month) <> 1
     or jsonb_typeof(p_splits) <> 'array' then
    raise exception 'Invalid purchase';
  end if;
  if not exists (select 1 from public.credit_cards where id = p_card_id and user_id = v_user_id) then
    raise exception 'Card not found';
  end if;

  select count(*), sum((value->>'amount')::numeric) into v_count, v_sum
  from jsonb_array_elements(p_splits) as item(value);
  if v_count < 1 or v_count > 100 or v_sum <> p_amount
     or exists (select 1 from jsonb_array_elements(p_splits) as item(value)
                where (value->>'amount')::numeric <= 0
                or (value->>'amount')::numeric <> round((value->>'amount')::numeric, 2))
     or exists (select 1 from jsonb_array_elements(p_splits) as item(value)
                group by nullif(value->>'participantId', '')
                having count(*) > 1) then
    raise exception 'Invalid purchase splits';
  end if;

  if p_id is null then
    insert into public.credit_card_purchases (user_id, card_id, description, amount, purchased_on, invoice_month)
    values (v_user_id, p_card_id, btrim(p_description), p_amount, p_purchased_on, p_invoice_month)
    returning id into v_id;
  else
    update public.credit_card_purchases
    set card_id = p_card_id, description = btrim(p_description), amount = p_amount,
        purchased_on = p_purchased_on, invoice_month = p_invoice_month
    where id = p_id and user_id = v_user_id returning id into v_id;
    if v_id is null then raise exception 'Purchase not found'; end if;

    delete from public.credit_card_purchase_splits as split
    where split.purchase_id = v_id and split.user_id = v_user_id
      and not exists (
        select 1 from jsonb_array_elements(p_splits) as item(value)
        where split.participant_id is not distinct from nullif(value->>'participantId', '')::uuid
      );

    update public.credit_card_purchase_splits as split
    set amount = (item.value->>'amount')::numeric
    from jsonb_array_elements(p_splits) as item(value)
    where split.purchase_id = v_id and split.user_id = v_user_id
      and split.participant_id is not distinct from nullif(item.value->>'participantId', '')::uuid;
  end if;

  insert into public.credit_card_purchase_splits (user_id, purchase_id, participant_id, amount)
  select v_user_id, v_id, nullif(item.value->>'participantId', '')::uuid, (item.value->>'amount')::numeric
  from jsonb_array_elements(p_splits) as item(value)
  where not exists (
    select 1 from public.credit_card_purchase_splits as split
    where split.purchase_id = v_id
      and split.participant_id is not distinct from nullif(item.value->>'participantId', '')::uuid
  );
  return v_id;
end;
$$;

create function private.sync_credit_card_purchase_expense()
returns trigger language plpgsql security invoker set search_path = '' as $$
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
        due_date = v_invoice_month,
        status = 'PAID'
    where credit_card_purchase_id = v_purchase_id;
  end if;
  return null;
end;
$$;

create constraint trigger sync_credit_card_purchase_expense_from_purchase
after update on public.credit_card_purchases
deferrable initially deferred for each row
execute function private.sync_credit_card_purchase_expense();

create constraint trigger sync_credit_card_purchase_expense_from_split
after insert or update or delete on public.credit_card_purchase_splits
deferrable initially deferred for each row
execute function private.sync_credit_card_purchase_expense();

create function public.set_credit_card_split_payment(
  p_split_id uuid, p_is_paid boolean, p_category text default null
) returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_participant_id uuid;
  v_purchase_id uuid;
  v_description text;
  v_amount numeric;
  v_invoice_month date;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  select split.participant_id, split.purchase_id, purchase.description, split.amount, purchase.invoice_month
  into v_participant_id, v_purchase_id, v_description, v_amount, v_invoice_month
  from public.credit_card_purchase_splits as split
  join public.credit_card_purchases as purchase on purchase.id = split.purchase_id
  where split.id = p_split_id and split.user_id = v_user_id and purchase.user_id = v_user_id;
  if not found then raise exception 'Split not found'; end if;
  if p_category is not null and (v_participant_id is not null or char_length(btrim(p_category)) not between 1 and 100) then
    raise exception 'Invalid expense category';
  end if;

  update public.credit_card_purchase_splits
  set paid_at = case when p_is_paid then timezone('utc', now()) else null end
  where id = p_split_id and user_id = v_user_id;

  if v_participant_id is null then
    if p_is_paid and p_category is not null then
      insert into public.expenses (
        user_id, description, reference_amount, paid_amount, due_date, paid_at,
        category, status, credit_card_purchase_id
      ) values (
        v_user_id, v_description, v_amount, v_amount, v_invoice_month, current_date,
        btrim(p_category), 'PAID', v_purchase_id
      ) on conflict (credit_card_purchase_id) do update
      set category = excluded.category;
    elsif not p_is_paid then
      delete from public.expenses where credit_card_purchase_id = v_purchase_id and user_id = v_user_id;
    end if;
  end if;
end;
$$;

revoke all on function public.set_credit_card_split_payment(uuid, boolean, text) from public, anon;
grant execute on function public.set_credit_card_split_payment(uuid, boolean, text) to authenticated;
