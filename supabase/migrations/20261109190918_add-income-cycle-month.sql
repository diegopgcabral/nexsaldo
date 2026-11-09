alter table public.incomes
  add column cycle_month date;

update public.incomes as income
set cycle_month = case
  when profile.financial_cycle_start_day = 1 then date_trunc('month', income.received_on)::date
  when extract(day from income.received_on) >= least(
    profile.financial_cycle_start_day,
    extract(day from date_trunc('month', income.received_on) + interval '1 month - 1 day')::integer
  ) then (date_trunc('month', income.received_on) + interval '1 month')::date
  else date_trunc('month', income.received_on)::date
end
from public.profiles as profile
where profile.id = income.user_id;

alter table public.incomes
  alter column cycle_month set not null,
  add constraint incomes_cycle_month_first_day_check
    check (extract(day from cycle_month) = 1);

create index incomes_user_cycle_month_received_on_idx
  on public.incomes (user_id, cycle_month desc, received_on desc);
