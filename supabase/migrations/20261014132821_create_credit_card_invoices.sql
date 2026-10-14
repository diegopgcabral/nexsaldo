alter table public.credit_cards add constraint credit_cards_id_user_key unique (id, user_id);
alter table public.credit_card_participants add constraint credit_card_participants_id_user_key unique (id, user_id);

create table public.credit_card_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null,
  description text not null check (char_length(btrim(description)) between 1 and 160),
  amount numeric(14, 2) not null check (amount > 0),
  purchased_on date not null,
  invoice_month date not null check (extract(day from invoice_month) = 1),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint credit_card_purchases_card_user_fkey foreign key (card_id, user_id)
    references public.credit_cards (id, user_id) on delete cascade,
  constraint credit_card_purchases_id_user_key unique (id, user_id)
);

create index credit_card_purchases_user_card_month_idx
on public.credit_card_purchases (user_id, card_id, invoice_month, purchased_on desc);
create index credit_card_purchases_card_user_idx on public.credit_card_purchases (card_id, user_id);

create table public.credit_card_purchase_splits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  purchase_id uuid not null,
  participant_id uuid,
  amount numeric(14, 2) not null check (amount > 0),
  constraint credit_card_purchase_splits_purchase_user_fkey foreign key (purchase_id, user_id)
    references public.credit_card_purchases (id, user_id) on delete cascade,
  constraint credit_card_purchase_splits_participant_user_fkey foreign key (participant_id, user_id)
    references public.credit_card_participants (id, user_id)
);

create unique index credit_card_purchase_splits_owner_key
on public.credit_card_purchase_splits (purchase_id) where participant_id is null;
create unique index credit_card_purchase_splits_person_key
on public.credit_card_purchase_splits (purchase_id, participant_id) where participant_id is not null;
create index credit_card_purchase_splits_user_id_idx on public.credit_card_purchase_splits (user_id);
create index credit_card_purchase_splits_participant_user_idx on public.credit_card_purchase_splits (participant_id, user_id) where participant_id is not null;

alter table public.credit_card_purchases enable row level security;
alter table public.credit_card_purchase_splits enable row level security;
revoke all on table public.credit_card_purchases, public.credit_card_purchase_splits from anon, authenticated;
grant select, insert, update, delete on table public.credit_card_purchases, public.credit_card_purchase_splits to authenticated;

create policy "Users can view their own purchases" on public.credit_card_purchases
for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create their own purchases" on public.credit_card_purchases
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own purchases" on public.credit_card_purchases
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "Users can delete their own purchases" on public.credit_card_purchases
for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users can view their own splits" on public.credit_card_purchase_splits
for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create their own splits" on public.credit_card_purchase_splits
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own splits" on public.credit_card_purchase_splits
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "Users can delete their own splits" on public.credit_card_purchase_splits
for delete to authenticated using ((select auth.uid()) = user_id);

create trigger set_credit_card_purchases_updated_at before update on public.credit_card_purchases
for each row execute function private.set_updated_at();

create function public.save_credit_card_purchase(
  p_id uuid, p_card_id uuid, p_description text, p_amount numeric,
  p_purchased_on date, p_invoice_month date, p_splits jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_count integer;
  v_sum numeric;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if p_description is null or char_length(btrim(p_description)) not between 1 and 160
     or p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2)
     or p_purchased_on is null or p_invoice_month is null
     or extract(day from p_invoice_month) <> 1
     or jsonb_typeof(p_splits) <> 'array' then
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
                or (value->>'amount')::numeric <> round((value->>'amount')::numeric, 2)) then
    raise exception 'Splits must exactly match purchase amount';
  end if;

  if p_id is null then
    insert into public.credit_card_purchases (user_id, card_id, description, amount, purchased_on, invoice_month)
    values (v_user_id, p_card_id, btrim(p_description), p_amount, p_purchased_on, p_invoice_month)
    returning id into v_id;
  else
    update public.credit_card_purchases
    set card_id = p_card_id, description = btrim(p_description), amount = p_amount,
        purchased_on = p_purchased_on, invoice_month = p_invoice_month
    where id = p_id and user_id = v_user_id returning id into v_id;
    if v_id is null then raise exception 'Purchase not found'; end if;
    delete from public.credit_card_purchase_splits where purchase_id = v_id and user_id = v_user_id;
  end if;

  insert into public.credit_card_purchase_splits (user_id, purchase_id, participant_id, amount)
  select v_user_id, v_id, nullif(value->>'participantId', '')::uuid, (value->>'amount')::numeric
  from jsonb_array_elements(p_splits) as item(value);
  return v_id;
end;
$$;

revoke all on function public.save_credit_card_purchase(uuid, uuid, text, numeric, date, date, jsonb) from public, anon;
grant execute on function public.save_credit_card_purchase(uuid, uuid, text, numeric, date, date, jsonb) to authenticated;

create function private.check_credit_card_purchase_splits()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_purchase_id uuid;
  v_amount numeric;
  v_split_sum numeric;
begin
  if tg_table_name = 'credit_card_purchases' then
    v_purchase_id := new.id;
  elsif tg_op = 'DELETE' then
    v_purchase_id := old.purchase_id;
  else
    v_purchase_id := new.purchase_id;
  end if;
  select amount into v_amount from public.credit_card_purchases where id = v_purchase_id;
  if not found then return null; end if;
  select coalesce(sum(amount), 0) into v_split_sum
  from public.credit_card_purchase_splits where purchase_id = v_purchase_id;
  if v_split_sum <> v_amount then
    raise exception 'Purchase splits must equal purchase amount';
  end if;
  if tg_table_name = 'credit_card_purchase_splits' and tg_op = 'UPDATE' then
    if old.purchase_id <> new.purchase_id then
      select amount into v_amount from public.credit_card_purchases where id = old.purchase_id;
      if found then
        select coalesce(sum(amount), 0) into v_split_sum
        from public.credit_card_purchase_splits where purchase_id = old.purchase_id;
        if v_split_sum <> v_amount then
          raise exception 'Purchase splits must equal purchase amount';
        end if;
      end if;
    end if;
  end if;
  return null;
end;
$$;

create constraint trigger check_credit_card_purchase_amount
after insert or update on public.credit_card_purchases
deferrable initially deferred for each row
execute function private.check_credit_card_purchase_splits();

create constraint trigger check_credit_card_purchase_split_amount
after insert or update or delete on public.credit_card_purchase_splits
deferrable initially deferred for each row
execute function private.check_credit_card_purchase_splits();
