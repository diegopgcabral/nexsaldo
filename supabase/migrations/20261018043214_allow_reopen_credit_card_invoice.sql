grant delete on public.credit_card_invoice_closures to authenticated;

create policy "Users can reopen their own invoices"
on public.credit_card_invoice_closures for delete to authenticated
using ((select auth.uid()) = user_id);
