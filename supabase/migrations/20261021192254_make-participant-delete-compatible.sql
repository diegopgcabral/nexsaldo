create or replace function public.delete_credit_card_participant(
  p_participant_id uuid
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_purchase record;
  v_table_name text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.credit_card_participants
    where id = p_participant_id
      and user_id = v_user_id
      and not is_owner
  ) then
    raise exception 'Participant not found';
  end if;

  -- Some installations predate the account-division tables. Delete from every
  -- related table that exists, without preventing the participant removal.
  foreach v_table_name in array array[
    'credit_card_receipts',
    'participant_statement_visual_payment_statuses',
    'participant_statement_payments',
    'participant_statement_closures',
    'participant_manual_charges'
  ] loop
    if to_regclass(format('public.%I', v_table_name)) is not null then
      execute format(
        'delete from public.%I where participant_id = $1 and user_id = $2',
        v_table_name
      ) using p_participant_id, v_user_id;
    end if;
  end loop;

  for v_purchase in
    select purchase_id, sum(amount) as amount
    from public.credit_card_purchase_splits
    where participant_id = p_participant_id and user_id = v_user_id
    group by purchase_id
  loop
    if exists (
      select 1
      from public.credit_card_purchase_splits
      where purchase_id = v_purchase.purchase_id
        and user_id = v_user_id
        and participant_id is null
    ) then
      update public.credit_card_purchase_splits
      set amount = amount + v_purchase.amount
      where purchase_id = v_purchase.purchase_id
        and user_id = v_user_id
        and participant_id is null;
    else
      insert into public.credit_card_purchase_splits (
        user_id, purchase_id, participant_id, amount
      ) values (v_user_id, v_purchase.purchase_id, null, v_purchase.amount);
    end if;
  end loop;

  delete from public.credit_card_purchase_splits
  where participant_id = p_participant_id and user_id = v_user_id;

  delete from public.credit_card_participants
  where id = p_participant_id
    and user_id = v_user_id
    and not is_owner;
end;
$$;

revoke all on function public.delete_credit_card_participant(uuid) from public, anon;
grant execute on function public.delete_credit_card_participant(uuid) to authenticated;
