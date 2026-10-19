alter table public.credit_card_participants
add column phone text;

alter table public.credit_card_participants
add constraint credit_card_participants_phone_check
check (phone is null or phone ~ '^[+]55[0-9]{10,11}$');
