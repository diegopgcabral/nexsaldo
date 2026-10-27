alter table public.expenses
  add column is_recurring boolean not null default false,
  add column recurrence_group_id uuid;

create unique index expenses_user_recurrence_due_date_key
  on public.expenses (user_id, recurrence_group_id, due_date)
  where recurrence_group_id is not null;

create function public.save_expense(
  p_id uuid,
  p_description text,
  p_reference_amount numeric,
  p_paid_amount numeric,
  p_due_date date,
  p_paid_at date,
  p_category text,
  p_status public.expense_status,
  p_notes text,
  p_is_recurring boolean default false
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_expense_id uuid;
  v_recurrence_group_id uuid;
  v_original_due_date date;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  if p_description is null
     or char_length(btrim(p_description)) not between 1 and 200
     or p_reference_amount is null
     or p_reference_amount <= 0
     or p_reference_amount <> round(p_reference_amount, 2)
     or p_paid_amount is null
     or p_paid_amount < 0
     or p_paid_amount <> round(p_paid_amount, 2)
     or p_due_date is null
     or p_category is null
     or char_length(btrim(p_category)) not between 1 and 100
     or p_status is null
     or p_is_recurring is null
     or (p_notes is not null and char_length(btrim(p_notes)) > 2000)
     or (p_status in ('PENDING', 'CANCELLED') and (p_paid_amount <> 0 or p_paid_at is not null))
     or (p_status = 'PAID' and p_paid_at is null) then
    raise exception 'Invalid expense';
  end if;

  if p_id is null then
    v_recurrence_group_id := case when p_is_recurring then gen_random_uuid() end;

    insert into public.expenses (
      user_id, description, reference_amount, paid_amount, due_date, paid_at,
      category, status, notes, is_recurring, recurrence_group_id
    ) values (
      v_user_id, btrim(p_description), p_reference_amount, p_paid_amount,
      p_due_date, p_paid_at, btrim(p_category), p_status,
      nullif(btrim(p_notes), ''), p_is_recurring, v_recurrence_group_id
    ) returning id into v_expense_id;
  else
    select due_date, recurrence_group_id
    into v_original_due_date, v_recurrence_group_id
    from public.expenses
    where id = p_id and user_id = v_user_id
    for update;

    if v_original_due_date is null then raise exception 'Expense not found'; end if;

    update public.expenses
    set description = btrim(p_description),
        reference_amount = p_reference_amount,
        paid_amount = p_paid_amount,
        due_date = p_due_date,
        paid_at = p_paid_at,
        category = btrim(p_category),
        status = p_status,
        notes = nullif(btrim(p_notes), ''),
        is_recurring = p_is_recurring,
        recurrence_group_id = case
          when p_is_recurring then coalesce(recurrence_group_id, gen_random_uuid())
          else null
        end
    where id = p_id and user_id = v_user_id
    returning id, recurrence_group_id into v_expense_id, v_recurrence_group_id;

    if p_is_recurring and v_recurrence_group_id is not null then
      update public.expenses
      set description = btrim(p_description),
          reference_amount = p_reference_amount,
          category = btrim(p_category),
          notes = nullif(btrim(p_notes), ''),
          due_date = (
            p_due_date + make_interval(
              months => (
                extract(year from due_date)::integer * 12
                + extract(month from due_date)::integer
                - extract(year from v_original_due_date)::integer * 12
                - extract(month from v_original_due_date)::integer
              )
            )
          )::date
      where user_id = v_user_id
        and recurrence_group_id = v_recurrence_group_id
        and id <> v_expense_id
        and due_date > v_original_due_date
        and status = 'PENDING';
    end if;
  end if;

  if p_is_recurring then
    insert into public.expenses (
      user_id, description, reference_amount, paid_amount, due_date, paid_at,
      category, status, notes, is_recurring, recurrence_group_id
    ) values (
      v_user_id, btrim(p_description), p_reference_amount, 0,
      (p_due_date + interval '1 month')::date, null, btrim(p_category),
      'PENDING', nullif(btrim(p_notes), ''), true, v_recurrence_group_id
    ) on conflict (user_id, recurrence_group_id, due_date)
      where recurrence_group_id is not null do nothing;
  end if;

  return v_expense_id;
end;
$$;

revoke all on function public.save_expense(uuid, text, numeric, numeric, date, date, text, public.expense_status, text, boolean) from public, anon;
grant execute on function public.save_expense(uuid, text, numeric, numeric, date, date, text, public.expense_status, text, boolean) to authenticated;
