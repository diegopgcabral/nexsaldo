grant select, insert, delete on table public.participant_statement_closures to authenticated;

drop policy if exists "Users can view their own statement closures"
on public.participant_statement_closures;

create policy "Users can view their own statement closures"
on public.participant_statement_closures for select to authenticated
using ((select auth.uid()) = user_id);
