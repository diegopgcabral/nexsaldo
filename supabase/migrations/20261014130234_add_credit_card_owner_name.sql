alter table public.profiles
add column credit_card_owner_name text
check (credit_card_owner_name is null or char_length(btrim(credit_card_owner_name)) between 1 and 100);
