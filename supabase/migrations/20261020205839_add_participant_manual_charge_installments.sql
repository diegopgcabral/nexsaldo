alter table public.participant_manual_charges
add column installment_group_id uuid,
add column installment_number smallint,
add column installment_count smallint;

update public.participant_manual_charges
set installment_group_id = id,
    installment_number = 1,
    installment_count = 1
where installment_group_id is null;

alter table public.participant_manual_charges
alter column installment_group_id set not null,
alter column installment_number set not null,
alter column installment_count set not null;

alter table public.participant_manual_charges
add constraint participant_manual_charges_installment_number_check
check (installment_number between 1 and installment_count),
add constraint participant_manual_charges_installment_count_check
check (installment_count between 1 and 120);

create unique index participant_manual_charges_user_installment_key
on public.participant_manual_charges (user_id, installment_group_id, installment_number);

create index participant_manual_charges_user_installment_group_idx
on public.participant_manual_charges (user_id, installment_group_id);

create function public.save_participant_manual_charge(
  p_id uuid,
  p_participant_id uuid,
  p_reference_month date,
  p_description text,
  p_amount numeric,
  p_due_on date,
  p_notes text,
  p_installment_number integer default 1,
  p_installment_count integer default 1
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_group_id uuid;
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
     or p_installment_number not between 1 and p_installment_count then
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
        notes = nullif(btrim(p_notes), '')
    where id = p_id
      and user_id = v_user_id
      and participant_id = p_participant_id
      and reference_month = p_reference_month
    returning id into v_id;
    if v_id is null then raise exception 'Manual charge not found'; end if;
    return v_id;
  end if;

  v_group_id := gen_random_uuid();
  for v_installment_number in p_installment_number..p_installment_count loop
    insert into public.participant_manual_charges (
      user_id,
      participant_id,
      reference_month,
      description,
      amount,
      due_on,
      notes,
      installment_group_id,
      installment_number,
      installment_count
    ) values (
      v_user_id,
      p_participant_id,
      (p_reference_month + make_interval(months => v_installment_number - p_installment_number))::date,
      btrim(p_description),
      p_amount,
      case
        when p_due_on is null then null
        else (p_due_on + make_interval(months => v_installment_number - p_installment_number))::date
      end,
      nullif(btrim(p_notes), ''),
      v_group_id,
      v_installment_number,
      p_installment_count
    ) returning id into v_id;
  end loop;

  return v_id;
end;
$$;

revoke all on function public.save_participant_manual_charge(uuid, uuid, date, text, numeric, date, text, integer, integer) from public, anon;
grant execute on function public.save_participant_manual_charge(uuid, uuid, date, text, numeric, date, text, integer, integer) to authenticated;

create table public.participant_statement_closures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  participant_id uuid not null,
  reference_month date not null check (extract(day from reference_month) = 1),
  closed_at timestamptz not null default timezone('utc', now()),
  constraint participant_statement_closures_participant_user_fkey
    foreign key (participant_id, user_id)
    references public.credit_card_participants (id, user_id) on delete restrict,
  constraint participant_statement_closures_user_participant_month_key
    unique (user_id, participant_id, reference_month)
);

create index participant_statement_closures_user_month_idx
on public.participant_statement_closures (user_id, reference_month);

alter table public.participant_statement_closures enable row level security;
revoke all on public.participant_statement_closures from anon, authenticated;
grant select, insert, delete on public.participant_statement_closures to authenticated;

create policy "Users can view their own statement closures"
on public.participant_statement_closures for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can close their own statements"
on public.participant_statement_closures for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can reopen their own statements"
on public.participant_statement_closures for delete to authenticated
using ((select auth.uid()) = user_id);

create function private.prevent_closed_participant_statement_changes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_participant_id uuid;
  v_reference_month date;
begin
  if tg_op = 'DELETE' then
    v_participant_id := old.participant_id;
    v_reference_month := old.reference_month;
  else
    v_participant_id := new.participant_id;
    v_reference_month := new.reference_month;
  end if;
  if exists (
    select 1
    from public.participant_statement_closures
    where user_id = v_user_id
      and participant_id = v_participant_id
      and reference_month = v_reference_month
  ) then
    raise exception 'Statement is finalized';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger prevent_closed_participant_manual_charge_changes
before insert or update or delete on public.participant_manual_charges
for each row execute function private.prevent_closed_participant_statement_changes();
