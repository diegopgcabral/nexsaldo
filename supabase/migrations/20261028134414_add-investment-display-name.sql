alter table public.investment_assets
  add column display_name text
  check (display_name is null or char_length(btrim(display_name)) between 1 and 160);
