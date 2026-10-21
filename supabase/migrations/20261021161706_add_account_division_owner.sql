alter table public.credit_card_participants
add column is_owner boolean not null default false;

create unique index credit_card_participants_user_owner_key
on public.credit_card_participants (user_id)
where is_owner;

insert into public.credit_card_participants (user_id, name, is_active, is_owner)
select id, '__titular__' || replace(id::text, '-', ''), true, true
from public.profiles
on conflict (user_id) where is_owner do nothing;

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
    (new.id, 'Outros', null),
    (new.id, 'Investimentos', null),
    (new.id, 'Combustível', null),
    (new.id, 'Seguros', null),
    (new.id, 'Academia', null),
    (new.id, 'Água', null),
    (new.id, 'Energia elétrica', null),
    (new.id, 'Telefonia', null),
    (new.id, 'TV/Internet', null),
    (new.id, 'Serviços', 'services')
  on conflict (user_id, normalized_name) do nothing;

  return new;
end;
$$;
