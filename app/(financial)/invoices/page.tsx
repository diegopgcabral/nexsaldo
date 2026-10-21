import { InvoiceOverview } from "@/components/financial/invoice-overview";
import type { CreditCardListItem } from "@/lib/financial/credit-card";
import type {
  PurchaseListItem,
  PurchaseSplit,
} from "@/lib/financial/credit-card-invoice";
import {
  getCurrentMonthReference,
  isMonthReference,
} from "@/lib/financial/month";
import type { ParticipantListItem } from "@/lib/financial/participant";
import { createClient } from "@/lib/supabase/server";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const query = await searchParams;
  const month = isMonthReference(query.month ?? null)
    ? query.month!
    : getCurrentMonthReference();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  let cards: CreditCardListItem[] = [];
  let participants: ParticipantListItem[] = [];
  let purchases: PurchaseListItem[] = [];
  let ownerName = "Você";
  let closedCardIds: string[] = [];
  let loadError = false;

  if (typeof userId === "string") {
    const [
      cardResult,
      participantResult,
      profileResult,
      purchaseResult,
      closureResult,
    ] = await Promise.all([
      supabase
        .from("credit_cards")
        .select("id, bank_name, name, due_day")
        .eq("user_id", userId)
        .order("due_day", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true }),
      supabase
        .from("credit_card_participants")
        .select("id, name, is_active")
        .eq("user_id", userId)
        .eq("is_owner", false)
        .order("name"),
      supabase
        .from("profiles")
        .select("credit_card_owner_name, display_name")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("credit_card_purchases")
        .select(
          "id, card_id, description, amount, purchased_on, invoice_month, installment_number, installment_count, is_recurring, invoice_matched",
        )
        .eq("user_id", userId)
        .eq("invoice_month", `${month}-01`),
      supabase
        .from("credit_card_invoice_closures")
        .select("card_id")
        .eq("user_id", userId)
        .eq("invoice_month", `${month}-01`),
    ]);
    loadError = Boolean(
      cardResult.error ||
      participantResult.error ||
      profileResult.error ||
      purchaseResult.error ||
      closureResult.error,
    );
    cards = (cardResult.data ?? []).map((card) => ({
      id: card.id,
      bankName: card.bank_name,
      name: card.name,
      dueDay: card.due_day,
    }));
    participants = (participantResult.data ?? []).map((person) => ({
      id: person.id,
      name: person.name,
      isActive: person.is_active,
    }));
    ownerName =
      profileResult.data?.credit_card_owner_name ||
      profileResult.data?.display_name ||
      "Você";
    closedCardIds = (closureResult.data ?? []).map(
      (closure) => closure.card_id,
    );
    const purchaseRows = purchaseResult.data ?? [];
    const splitsByPurchase = new Map<string, PurchaseSplit[]>();
    if (purchaseRows.length) {
      const splitResult = await supabase
        .from("credit_card_purchase_splits")
        .select("id, purchase_id, participant_id, amount, paid_at")
        .eq("user_id", userId)
        .in(
          "purchase_id",
          purchaseRows.map((purchase) => purchase.id),
        );
      loadError ||= Boolean(splitResult.error);
      for (const split of splitResult.data ?? []) {
        const list = splitsByPurchase.get(split.purchase_id) ?? [];
        list.push({
          id: split.id,
          participantId: split.participant_id,
          amount: String(split.amount),
          paidAt: split.paid_at,
        });
        splitsByPurchase.set(split.purchase_id, list);
      }
    }
    purchases = purchaseRows.map((purchase) => ({
      id: purchase.id,
      cardId: purchase.card_id,
      description: purchase.description,
      amount: String(purchase.amount),
      purchasedOn: purchase.purchased_on,
      invoiceMonth: purchase.invoice_month.slice(0, 7),
      installmentNumber: purchase.installment_number,
      installmentCount: purchase.installment_count,
      isRecurring: purchase.is_recurring,
      isInvoiceMatched: purchase.invoice_matched,
      splits: splitsByPurchase.get(purchase.id) ?? [],
    }));
  }

  return (
    <InvoiceOverview
      cards={cards}
      participants={participants}
      purchases={purchases}
      ownerName={ownerName}
      month={month}
      loadError={loadError}
      closedCardIds={closedCardIds}
    />
  );
}
