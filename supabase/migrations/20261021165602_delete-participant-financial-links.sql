grant delete on table public.credit_card_receipts, public.participant_statement_visual_payment_statuses to authenticated;

create policy "Users can delete their own card receipts"
on public.credit_card_receipts for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can delete their own statement visual payment statuses"
on public.participant_statement_visual_payment_statuses for delete to authenticated
using ((select auth.uid()) = user_id);

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

  delete from public.credit_card_receipts
  where participant_id = p_participant_id and user_id = v_user_id;

  delete from public.participant_statement_visual_payment_statuses
  where participant_id = p_participant_id and user_id = v_user_id;

  delete from public.participant_statement_payments
  where participant_id = p_participant_id and user_id = v_user_id;

  delete from public.participant_statement_closures
  where participant_id = p_participant_id and user_id = v_user_id;

  delete from public.participant_manual_charges
  where participant_id = p_participant_id and user_id = v_user_id;

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
