alter table public.investment_product_types
  add column is_active boolean not null default true;
