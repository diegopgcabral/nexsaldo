alter table public.credit_card_purchases
add column is_recurring boolean not null default false,
add column recurrence_group_id uuid;

alter table public.participant_manual_charges
add column is_recurring boolean not null default false,
add column recurrence_group_id uuid;

create unique index credit_card_purchases_user_recurrence_month_key
on public.credit_card_purchases (user_id, recurrence_group_id, invoice_month)
where recurrence_group_id is not null;

create unique index participant_manual_charges_user_recurrence_month_key
on public.participant_manual_charges (user_id, recurrence_group_id, reference_month)
where recurrence_group_id is not null;

drop function public.save_credit_card_purchase(uuid, uuid, text, numeric, date, date, jsonb, integer, integer);

create function public.save_credit_card_purchase(
  p_id uuid,
  p_card_id uuid,
  p_description text,
  p_amount numeric,
  p_purchased_on date,
  p_invoice_month date,
  p_splits jsonb,
  p_installment_number integer default 1,
  p_installment_count integer default 1,
  p_is_recurring boolean default false
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_group_id uuid;
  v_recurrence_group_id uuid;
  v_installment_number integer;
  v_count integer;
  v_sum numeric;
  v_purchased_on date := coalesce(p_purchased_on, current_date);
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if p_description is null or char_length(btrim(p_description)) not between 1 and 160
     or p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2)
     or p_invoice_month is null or extract(day from p_invoice_month) <> 1
     or jsonb_typeof(p_splits) <> 'array'
     or p_installment_count not between 1 and 120
     or p_installment_number not between 1 and p_installment_count
     or p_is_recurring is null
     or (p_is_recurring and p_installment_count <> 1) then
    raise exception 'Invalid purchase';
  end if;
  if not exists (
    select 1 from public.credit_cards where id = p_card_id and user_id = v_user_id
  ) then
    raise exception 'Card not found';
  end if;

  select count(*), sum((value->>'amount')::numeric) into v_count, v_sum
  from jsonb_array_elements(p_splits) as item(value);
  if v_count < 1 or v_count > 100 or v_sum <> p_amount
     or exists (
       select 1 from jsonb_array_elements(p_splits) as item(value)
       where (value->>'amount')::numeric <= 0
          or (value->>'amount')::numeric <> round((value->>'amount')::numeric, 2)
     )
     or exists (
       select 1 from jsonb_array_elements(p_splits) as item(value)
       group by nullif(value->>'participantId', '')
       having count(*) > 1
     ) then
    raise exception 'Invalid purchase splits';
  end if;

  if p_id is null then
    v_group_id := gen_random_uuid();
    v_recurrence_group_id := case when p_is_recurring then gen_random_uuid() end;
    for v_installment_number in p_installment_number..p_installment_count loop
      insert into public.credit_card_purchases (
        user_id, card_id, description, amount, purchased_on, invoice_month,
        installment_group_id, installment_number, installment_count,
        is_recurring, recurrence_group_id
      ) values (
        v_user_id, p_card_id, btrim(p_description), p_amount,
        (v_purchased_on + make_interval(months => v_installment_number - p_installment_number))::date,
        (p_invoice_month + make_interval(months => v_installment_number - p_installment_number))::date,
        v_group_id, v_installment_number, p_installment_count,
        p_is_recurring, v_recurrence_group_id
      ) returning id into v_id;

      insert into public.credit_card_purchase_splits (user_id, purchase_id, participant_id, amount)
      select v_user_id, v_id, nullif(item.value->>'participantId', '')::uuid, (item.value->>'amount')::numeric
      from jsonb_array_elements(p_splits) as item(value);
    end loop;
  else
    update public.credit_card_purchases
    set card_id = p_card_id,
        description = btrim(p_description),
        amount = p_amount,
        purchased_on = v_purchased_on,
        invoice_month = p_invoice_month,
        is_recurring = p_is_recurring,
        recurrence_group_id = case
          when p_is_recurring then coalesce(recurrence_group_id, gen_random_uuid())
          else null
        end
    where id = p_id and user_id = v_user_id
    returning id into v_id;
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

revoke all on function public.save_credit_card_purchase(uuid, uuid, text, numeric, date, date, jsonb, integer, integer, boolean) from public, anon;
grant execute on function public.save_credit_card_purchase(uuid, uuid, text, numeric, date, date, jsonb, integer, integer, boolean) to authenticated;

create or replace function public.close_credit_card_invoice(
  p_card_id uuid,
  p_invoice_month date
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_purchase record;
  v_next_purchase_id uuid;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if p_invoice_month is null or extract(day from p_invoice_month) <> 1 then
    raise exception 'Invalid invoice month';
  end if;
  perform 1
  from public.credit_cards
  where id = p_card_id and user_id = v_user_id
  for update;
  if not found then raise exception 'Card not found'; end if;

  insert into public.credit_card_invoice_closures (card_id, user_id, invoice_month)
  values (p_card_id, v_user_id, p_invoice_month)
  on conflict (card_id, invoice_month) do nothing;
  if not found then return; end if;

  for v_purchase in
    select *
    from public.credit_card_purchases
    where user_id = v_user_id
      and card_id = p_card_id
      and invoice_month = p_invoice_month
      and is_recurring
    for key share
  loop
    if not exists (
      select 1
      from public.credit_card_purchases
      where user_id = v_user_id
        and recurrence_group_id = v_purchase.recurrence_group_id
        and invoice_month = (p_invoice_month + interval '1 month')::date
    ) then
      insert into public.credit_card_purchases (
        user_id, card_id, description, amount, purchased_on, invoice_month,
        installment_group_id, installment_number, installment_count,
        is_recurring, recurrence_group_id
      ) values (
        v_user_id, v_purchase.card_id, v_purchase.description, v_purchase.amount,
        (v_purchase.purchased_on + interval '1 month')::date,
        (p_invoice_month + interval '1 month')::date,
        v_purchase.installment_group_id, v_purchase.installment_number,
        v_purchase.installment_count, true, v_purchase.recurrence_group_id
      ) returning id into v_next_purchase_id;

      insert into public.credit_card_purchase_splits (user_id, purchase_id, participant_id, amount)
      select v_user_id, v_next_purchase_id, participant_id, amount
      from public.credit_card_purchase_splits
      where purchase_id = v_purchase.id and user_id = v_user_id;
    end if;
  end loop;
end;
$$;

drop function public.save_participant_manual_charge(uuid, uuid, date, text, numeric, date, text, integer, integer);

create or replace function public.save_participant_manual_charge(
  p_id uuid,
  p_participant_id uuid,
  p_reference_month date,
  p_description text,
  p_amount numeric,
  p_due_on date,
  p_notes text,
  p_installment_number integer default 1,
  p_installment_count integer default 1,
  p_is_recurring boolean default false
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_group_id uuid;
  v_recurrence_group_id uuid;
  v_installment_number integer;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if p_participant_id is null
     or p_reference_month is null
     or extract(day from p_reference_month) <> 1
     or p_description is null
     or char_length(btrim(p_description)) not between 1 and 200
     or p_amount is null
     or p_amount <= 0
     or p_amount <> round(p_amount, 2)
     or (p_due_on is not null and extract(day from p_due_on) <> 1)
     or (p_notes is not null and char_length(btrim(p_notes)) > 500)
     or p_installment_count not between 1 and 120
     or p_installment_number not between 1 and p_installment_count
     or p_is_recurring is null
     or (p_is_recurring and p_installment_count <> 1) then
    raise exception 'Invalid manual charge';
  end if;

  if not exists (
    select 1
    from public.credit_card_participants
    where id = p_participant_id and user_id = v_user_id
  ) then
    raise exception 'Participant not found';
  end if;

  if p_id is not null then
    update public.participant_manual_charges
    set description = btrim(p_description),
        amount = p_amount,
        due_on = p_due_on,
        notes = nullif(btrim(p_notes), ''),
        is_recurring = p_is_recurring,
        recurrence_group_id = case
          when p_is_recurring then coalesce(recurrence_group_id, gen_random_uuid())
          else null
        end
    where id = p_id
      and user_id = v_user_id
      and participant_id = p_participant_id
      and reference_month = p_reference_month
    returning id into v_id;
    if v_id is null then raise exception 'Manual charge not found'; end if;
    return v_id;
  end if;

  v_group_id := gen_random_uuid();
  v_recurrence_group_id := case when p_is_recurring then gen_random_uuid() end;
  for v_installment_number in p_installment_number..p_installment_count loop
    insert into public.participant_manual_charges (
      user_id, participant_id, reference_month, description, amount, due_on,
      notes, installment_group_id, installment_number, installment_count,
      is_recurring, recurrence_group_id
    ) values (
      v_user_id, p_participant_id,
      (p_reference_month + make_interval(months => v_installment_number - p_installment_number))::date,
      btrim(p_description), p_amount,
      case
        when p_due_on is null then null
        else (p_due_on + make_interval(months => v_installment_number - p_installment_number))::date
      end,
      nullif(btrim(p_notes), ''), v_group_id, v_installment_number,
      p_installment_count, p_is_recurring, v_recurrence_group_id
    ) returning id into v_id;
  end loop;

  return v_id;
end;
$$;

revoke all on function public.save_participant_manual_charge(uuid, uuid, date, text, numeric, date, text, integer, integer, boolean) from public, anon;
grant execute on function public.save_participant_manual_charge(uuid, uuid, date, text, numeric, date, text, integer, integer, boolean) to authenticated;

create function private.copy_recurring_manual_charges_on_statement_close()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_charge record;
begin
  for v_charge in
    select *
    from public.participant_manual_charges
    where user_id = new.user_id
      and participant_id = new.participant_id
      and reference_month = new.reference_month
      and is_recurring
    for key share
  loop
    if not exists (
      select 1
      from public.participant_manual_charges
      where user_id = new.user_id
        and recurrence_group_id = v_charge.recurrence_group_id
        and reference_month = (new.reference_month + interval '1 month')::date
    ) then
      insert into public.participant_manual_charges (
        user_id, participant_id, reference_month, description, amount, due_on,
        notes, installment_group_id, installment_number, installment_count,
        is_recurring, recurrence_group_id
      ) values (
        new.user_id, v_charge.participant_id,
        (new.reference_month + interval '1 month')::date,
        v_charge.description, v_charge.amount,
        case
          when v_charge.due_on is null then null
          else (v_charge.due_on + interval '1 month')::date
        end,
        v_charge.notes, v_charge.installment_group_id,
        v_charge.installment_number, v_charge.installment_count,
        true, v_charge.recurrence_group_id
      );
    end if;
  end loop;
  return new;
end;
$$;

create trigger copy_recurring_manual_charges_on_statement_close
after insert on public.participant_statement_closures
for each row execute function private.copy_recurring_manual_charges_on_statement_close();
