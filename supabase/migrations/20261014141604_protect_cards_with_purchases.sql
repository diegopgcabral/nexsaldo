alter table public.credit_card_purchases
drop constraint credit_card_purchases_card_user_fkey;

alter table public.credit_card_purchases
add constraint credit_card_purchases_card_user_fkey
foreign key (card_id, user_id)
references public.credit_cards (id, user_id)
on delete restrict;
