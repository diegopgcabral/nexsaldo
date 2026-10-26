insert into public.expense_categories (user_id, name, icon_key)
select profiles.id, 'Cartão de crédito', 'card'
from public.profiles as profiles
on conflict (user_id, normalized_name) do update
  set icon_key = excluded.icon_key
  where public.expense_categories.icon_key is null;
