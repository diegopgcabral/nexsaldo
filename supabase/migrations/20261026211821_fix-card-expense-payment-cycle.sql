update public.expenses
set due_date = paid_at
where credit_card_purchase_id is not null
  and paid_at is not null
  and due_date is distinct from paid_at;

create or replace function public.set_credit_card_split_payment(
  p_split_id uuid, p_is_paid boolean, p_category text default null
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_participant_id uuid;
  v_purchase_id uuid;
  v_description text;
  v_amount numeric;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  select split.participant_id, split.purchase_id, purchase.description, split.amount
  into v_participant_id, v_purchase_id, v_description, v_amount
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
        v_user_id, v_description, v_amount, v_amount, current_date, current_date,
        btrim(p_category), 'PAID', v_purchase_id
      ) on conflict (credit_card_purchase_id) do update
      set category = excluded.category,
          due_date = excluded.due_date,
          paid_at = excluded.paid_at;
    elsif not p_is_paid then
      delete from public.expenses where credit_card_purchase_id = v_purchase_id and user_id = v_user_id;
    end if;
  end if;
end;
$$;
