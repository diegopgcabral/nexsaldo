drop function public.save_credit_card_purchase(uuid, uuid, text, numeric, date, date, jsonb, integer);

create function public.save_credit_card_purchase(
  p_id uuid, p_card_id uuid, p_description text, p_amount numeric,
  p_purchased_on date, p_invoice_month date, p_splits jsonb,
  p_installment_number integer default 1, p_installment_count integer default 1
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_group_id uuid;
  v_installment_number integer;
  v_count integer;
  v_sum numeric;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if p_description is null or char_length(btrim(p_description)) not between 1 and 160
     or p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2)
     or p_purchased_on is null or p_invoice_month is null
     or extract(day from p_invoice_month) <> 1
     or jsonb_typeof(p_splits) <> 'array'
     or p_installment_count not between 1 and 120
     or p_installment_number not between 1 and p_installment_count then
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
    v_group_id := gen_random_uuid();
    for v_installment_number in p_installment_number..p_installment_count loop
      insert into public.credit_card_purchases (
        user_id, card_id, description, amount, purchased_on, invoice_month,
        installment_group_id, installment_number, installment_count
      ) values (
        v_user_id, p_card_id, btrim(p_description), p_amount,
        (p_purchased_on + make_interval(months => v_installment_number - p_installment_number))::date,
        (p_invoice_month + make_interval(months => v_installment_number - p_installment_number))::date,
        v_group_id, v_installment_number, p_installment_count
      ) returning id into v_id;

      insert into public.credit_card_purchase_splits (user_id, purchase_id, participant_id, amount)
      select v_user_id, v_id, nullif(item.value->>'participantId', '')::uuid, (item.value->>'amount')::numeric
      from jsonb_array_elements(p_splits) as item(value);
    end loop;
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

    insert into public.credit_card_purchase_splits (user_id, purchase_id, participant_id, amount)
    select v_user_id, v_id, nullif(item.value->>'participantId', '')::uuid, (item.value->>'amount')::numeric
    from jsonb_array_elements(p_splits) as item(value)
    where not exists (
      select 1 from public.credit_card_purchase_splits as split
      where split.purchase_id = v_id
        and split.participant_id is not distinct from nullif(item.value->>'participantId', '')::uuid
    );
  end if;
  return v_id;
end;
$$;

revoke all on function public.save_credit_card_purchase(uuid, uuid, text, numeric, date, date, jsonb, integer, integer) from public, anon;
grant execute on function public.save_credit_card_purchase(uuid, uuid, text, numeric, date, date, jsonb, integer, integer) to authenticated;
