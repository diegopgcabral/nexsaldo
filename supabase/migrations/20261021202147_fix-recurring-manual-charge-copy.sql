create or replace function private.copy_recurring_manual_charges_on_statement_close()
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
        v_charge.notes,
        gen_random_uuid(),
        1,
        1,
        true,
        v_charge.recurrence_group_id
      );
    end if;
  end loop;
  return new;
end;
$$;
