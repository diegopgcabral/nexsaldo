alter table public.expense_categories
  drop constraint expense_categories_icon_key_check;

alter table public.expense_categories
  add constraint expense_categories_icon_key_check
  check (
    icon_key is null
    or icon_key in (
      'food', 'home', 'card', 'car', 'health', 'medicine', 'education',
      'subscription', 'services', 'water', 'gas', 'energy', 'phone', 'tv',
      'insurance', 'gym', 'investment', 'money', 'shopping', 'clothing',
      'leisure', 'domestic', 'pet', 'travel', 'gift', 'family', 'work',
      'bill', 'other'
    )
  );

insert into public.expense_categories (user_id, name, icon_key)
select profiles.id, 'Vestuário', 'clothing'
from public.profiles as profiles
on conflict (user_id, normalized_name) do update
  set icon_key = excluded.icon_key,
      is_active = true;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name')
  on conflict (id) do nothing;

  insert into public.credit_card_participants (user_id, name, is_active, is_owner)
  values (new.id, '__titular__' || replace(new.id::text, '-', ''), true, true)
  on conflict (user_id) where is_owner do nothing;

  insert into public.expense_categories (user_id, name, icon_key)
  values
    (new.id, 'Alimentação', null),
    (new.id, 'Saúde', null),
    (new.id, 'Educação', null),
    (new.id, 'Assinaturas', null),
    (new.id, 'Cartão de crédito', null),
    (new.id, 'Lazer', null),
    (new.id, 'Compras', null),
    (new.id, 'Vestuário', 'clothing'),
    (new.id, 'Outros', null),
    (new.id, 'Investimentos', null),
    (new.id, 'Combustível', null),
    (new.id, 'Seguros', null),
    (new.id, 'Academia', null),
    (new.id, 'Água', null),
    (new.id, 'Gás', 'gas'),
    (new.id, 'Energia elétrica', null),
    (new.id, 'Telefonia', null),
    (new.id, 'TV/Internet', null),
    (new.id, 'Serviços', 'services'),
    (new.id, 'Delivery', 'food')
  on conflict (user_id, normalized_name) do nothing;

  return new;
end;
$$;
