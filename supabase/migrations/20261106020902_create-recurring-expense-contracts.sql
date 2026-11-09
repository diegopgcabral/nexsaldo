create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  description text not null check (char_length(btrim(description)) between 1 and 200),
  reference_amount numeric(14, 2) not null check (reference_amount > 0),
  due_day smallint not null check (due_day between 1 and 31),
  category text not null check (char_length(btrim(category)) between 1 and 100),
  notes text check (notes is null or char_length(btrim(notes)) <= 2000),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index recurring_expenses_user_active_name_idx
  on public.recurring_expenses (user_id, is_active, description);

alter table public.recurring_expenses enable row level security;
revoke all on public.recurring_expenses from anon, authenticated;
grant select, insert, update, delete on public.recurring_expenses to authenticated;

create policy "Users manage their own recurring expenses"
  on public.recurring_expenses
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create trigger set_recurring_expenses_updated_at
before update on public.recurring_expenses
for each row execute function private.set_updated_at();

alter table public.expenses
  add column recurring_expense_id uuid
  references public.recurring_expenses (id) on delete set null;

create index expenses_user_recurring_expense_idx
  on public.expenses (user_id, recurring_expense_id)
  where recurring_expense_id is not null;

create unique index expenses_user_recurring_expense_due_date_key
  on public.expenses (user_id, recurring_expense_id, due_date)
  where recurring_expense_id is not null;

create temporary table recurring_expense_backfill (
  id uuid primary key,
  user_id uuid not null,
  recurrence_group_id uuid not null,
  description text not null,
  reference_amount numeric not null,
  due_day smallint not null,
  category text not null,
  notes text
) on commit drop;

insert into recurring_expense_backfill (
  id, user_id, recurrence_group_id, description, reference_amount,
  due_day, category, notes
)
select distinct on (expense.user_id, expense.recurrence_group_id)
  gen_random_uuid(),
  expense.user_id,
  expense.recurrence_group_id,
  expense.description,
  expense.reference_amount,
  extract(day from expense.due_date)::smallint,
  expense.category,
  expense.notes
from public.expenses as expense
where expense.is_recurring
  and expense.recurrence_group_id is not null
order by
  expense.user_id,
  expense.recurrence_group_id,
  (expense.status = 'PENDING') desc,
  expense.due_date;

insert into public.recurring_expenses (
  id, user_id, description, reference_amount, due_day, category, notes
)
select id, user_id, description, reference_amount, due_day, category, notes
from recurring_expense_backfill;

update public.expenses as expense
set recurring_expense_id = backfill.id
from recurring_expense_backfill as backfill
where expense.user_id = backfill.user_id
  and expense.recurrence_group_id = backfill.recurrence_group_id;

create or replace function public.save_expense(
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
  v_recurring_expense_id uuid;
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
    if p_is_recurring then
      insert into public.recurring_expenses (
        user_id, description, reference_amount, due_day, category, notes
      ) values (
        v_user_id, btrim(p_description), p_reference_amount,
        extract(day from p_due_date)::smallint, btrim(p_category),
        nullif(btrim(p_notes), '')
      ) returning id into v_recurring_expense_id;
      v_recurrence_group_id := gen_random_uuid();
    end if;

    insert into public.expenses (
      user_id, description, reference_amount, paid_amount, due_date, paid_at,
      category, status, notes, is_recurring, recurrence_group_id,
      recurring_expense_id
    ) values (
      v_user_id, btrim(p_description), p_reference_amount, p_paid_amount,
      p_due_date, p_paid_at, btrim(p_category), p_status,
      nullif(btrim(p_notes), ''), p_is_recurring, v_recurrence_group_id,
      v_recurring_expense_id
    ) returning id into v_expense_id;

    if p_is_recurring then
      insert into public.expenses (
        user_id, description, reference_amount, paid_amount, due_date, paid_at,
        category, status, notes, is_recurring, recurrence_group_id,
        recurring_expense_id
      ) values (
        v_user_id, btrim(p_description), p_reference_amount, 0,
        (p_due_date + interval '1 month')::date, null, btrim(p_category),
        'PENDING', nullif(btrim(p_notes), ''), true, v_recurrence_group_id,
        v_recurring_expense_id
      ) on conflict (user_id, recurring_expense_id, due_date)
        where recurring_expense_id is not null do nothing;
    end if;
    return v_expense_id;
  end if;

  select due_date, recurring_expense_id, recurrence_group_id
  into v_original_due_date, v_recurring_expense_id, v_recurrence_group_id
  from public.expenses
  where id = p_id and user_id = v_user_id
  for update;
  if v_original_due_date is null then raise exception 'Expense not found'; end if;

  if v_recurring_expense_id is null and p_is_recurring then
    insert into public.recurring_expenses (
      user_id, description, reference_amount, due_day, category, notes
    ) values (
      v_user_id, btrim(p_description), p_reference_amount,
      extract(day from p_due_date)::smallint, btrim(p_category),
      nullif(btrim(p_notes), '')
    ) returning id into v_recurring_expense_id;
    v_recurrence_group_id := coalesce(v_recurrence_group_id, gen_random_uuid());
  end if;

  if v_recurring_expense_id is not null and not p_is_recurring then
    update public.recurring_expenses
    set is_active = false
    where id = v_recurring_expense_id and user_id = v_user_id;

    delete from public.expenses
    where user_id = v_user_id
      and recurring_expense_id = v_recurring_expense_id
      and due_date > v_original_due_date
      and status = 'PENDING';
  elsif v_recurring_expense_id is not null then
    update public.recurring_expenses
    set description = btrim(p_description),
        reference_amount = p_reference_amount,
        due_day = extract(day from p_due_date)::smallint,
        category = btrim(p_category),
        notes = nullif(btrim(p_notes), ''),
        is_active = true
    where id = v_recurring_expense_id and user_id = v_user_id;

    delete from public.expenses
    where user_id = v_user_id
      and recurring_expense_id = v_recurring_expense_id
      and due_date > v_original_due_date
      and status = 'PENDING';
  end if;

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
      recurrence_group_id = case when p_is_recurring then v_recurrence_group_id else null end,
      recurring_expense_id = case when p_is_recurring then v_recurring_expense_id else null end
  where id = p_id and user_id = v_user_id
  returning id into v_expense_id;

  if p_is_recurring and v_recurring_expense_id is not null then
    insert into public.expenses (
      user_id, description, reference_amount, paid_amount, due_date, paid_at,
      category, status, notes, is_recurring, recurrence_group_id,
      recurring_expense_id
    ) values (
      v_user_id, btrim(p_description), p_reference_amount, 0,
      (p_due_date + interval '1 month')::date, null, btrim(p_category),
      'PENDING', nullif(btrim(p_notes), ''), true, v_recurrence_group_id,
      v_recurring_expense_id
    ) on conflict (user_id, recurring_expense_id, due_date)
      where recurring_expense_id is not null do nothing;
  end if;

  return v_expense_id;
end;
$$;
