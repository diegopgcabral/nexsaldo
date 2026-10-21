grant delete on table public.credit_card_participants to authenticated;

create policy "Users can delete their own participants"
on public.credit_card_participants for delete to authenticated
using ((select auth.uid()) = user_id and not is_owner);

