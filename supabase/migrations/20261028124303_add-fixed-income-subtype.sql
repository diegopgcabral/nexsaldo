create type public.investment_fixed_income_subtype as enum (
  'DIRECT_TREASURY',
  'CDB',
  'LCI',
  'LCA',
  'DEBENTURE',
  'CRI_CRA',
  'CASH_BOX',
  'OTHER'
);

alter table public.investment_assets
  add column fixed_income_subtype public.investment_fixed_income_subtype;

update public.investment_assets
  set fixed_income_subtype = 'OTHER'
  where asset_class = 'FIXED_INCOME';

alter table public.investment_assets
  add constraint investment_assets_fixed_income_subtype_check
  check (
    (asset_class = 'FIXED_INCOME' and fixed_income_subtype is not null)
    or (asset_class <> 'FIXED_INCOME' and fixed_income_subtype is null)
  );
