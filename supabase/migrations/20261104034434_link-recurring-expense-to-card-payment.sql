drop function public.set_credit_card_split_payment(uuid, boolean, text);

create function public.set_credit_card_split_payment(
  p_split_id uuid,
  p_is_paid boolean,
  p_category text default null,
  p_recurring_expense_id uuid default null
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_participant_id uuid;
  v_purchase_id uuid;
  v_amount numeric;
  v_recurring_expense_id uuid;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  select split.participant_id, split.purchase_id, split.amount
  into v_participant_id, v_purchase_id, v_amount
  from public.credit_card_purchase_splits as split
  join public.credit_card_purchases as purchase on purchase.id = split.purchase_id
  where split.id = p_split_id
    and split.user_id = v_user_id
    and purchase.user_id = v_user_id;
  if not found then raise exception 'Split not found'; end if;

  if p_category is not null
    and (v_participant_id is not null or char_length(btrim(p_category)) not between 1 and 100) then
    raise exception 'Invalid expense category';
  end if;
  if p_recurring_expense_id is not null
    and (not p_is_paid or v_participant_id is not null or p_category is not null) then
    raise exception 'Invalid recurring expense link';
  end if;

  update public.credit_card_purchase_splits
  set paid_at = case when p_is_paid then timezone('utc', now()) else null end
  where id = p_split_id and user_id = v_user_id;

  if v_participant_id is not null then return; end if;

  if p_is_paid and p_recurring_expense_id is not null then
    select expense.id
    into v_recurring_expense_id
    from public.expenses as expense
    where expense.id = p_recurring_expense_id
      and expense.user_id = v_user_id
      and expense.is_recurring
      and expense.status = 'PENDING'
      and expense.credit_card_purchase_id is null
    for update;
    if v_recurring_expense_id is null then
      raise exception 'Recurring expense not available';
    end if;

    update public.expenses
    set paid_amount = v_amount,
        paid_at = current_date,
        status = 'PAID',
        credit_card_purchase_id = v_purchase_id
    where id = v_recurring_expense_id and user_id = v_user_id;
  elsif p_is_paid and p_category is not null then
    insert into public.expenses (
      user_id, description, reference_amount, paid_amount, due_date, paid_at,
      category, status, credit_card_purchase_id
    )
    select v_user_id, purchase.description, v_amount, v_amount, current_date,
      current_date, btrim(p_category), 'PAID', v_purchase_id
    from public.credit_card_purchases as purchase
    where purchase.id = v_purchase_id and purchase.user_id = v_user_id
    on conflict (credit_card_purchase_id) do update
    set category = excluded.category,
        due_date = excluded.due_date,
        paid_at = excluded.paid_at;
  elsif not p_is_paid then
    update public.expenses
    set paid_amount = 0,
        paid_at = null,
        status = 'PENDING',
        credit_card_purchase_id = null
    where user_id = v_user_id
      and credit_card_purchase_id = v_purchase_id
      and is_recurring;

    delete from public.expenses
    where user_id = v_user_id
      and credit_card_purchase_id = v_purchase_id
      and not is_recurring;
  end if;
end;
$$;

revoke all on function public.set_credit_card_split_payment(uuid, boolean, text, uuid) from public, anon;
grant execute on function public.set_credit_card_split_payment(uuid, boolean, text, uuid) to authenticated;
