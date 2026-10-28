import { ReconciliationManager } from "@/components/financial/reconciliation-manager";
import type { CreditCardListItem } from "@/lib/financial/credit-card";
import type {
  PurchaseListItem,
  PurchaseSplit,
} from "@/lib/financial/credit-card-invoice";
import {
  getCurrentCycleReference,
  isMonthReference,
} from "@/lib/financial/month";
import type { ParticipantListItem } from "@/lib/financial/participant";
import { createClient } from "@/lib/supabase/server";

export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  const { data: cycleProfile } =
    typeof userId === "string"
      ? await supabase
          .from("profiles")
          .select("financial_cycle_start_day")
          .eq("id", userId)
          .maybeSingle()
      : { data: null };
  const month = isMonthReference(query.month ?? null)
    ? query.month!
    : getCurrentCycleReference(
        new Date(),
        cycleProfile?.financial_cycle_start_day ?? 1,
      );
  let cards: CreditCardListItem[] = [],
    participants: ParticipantListItem[] = [],
    purchases: PurchaseListItem[] = [],
    receipts: {
      id: string;
      cardId: string;
      participantId: string;
      amount: string;
      receivedOn: string;
      notes: string | null;
    }[] = [];
  let ownerName = "Você";
  if (typeof userId === "string") {
    const [
      closures,
      cardResult,
      participantResult,
      profileResult,
      receiptResult,
    ] = await Promise.all([
      supabase
        .from("credit_card_invoice_closures")
        .select("card_id")
        .eq("user_id", userId)
        .eq("invoice_month", `${month}-01`),
      supabase
        .from("credit_cards")
        .select("id, bank_name, name, due_day")
        .eq("user_id", userId),
      supabase
        .from("credit_card_participants")
        .select("id, name, is_active")
        .eq("user_id", userId)
        .eq("is_owner", false),
      supabase
        .from("profiles")
        .select("credit_card_owner_name, display_name")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("credit_card_receipts")
        .select("id, card_id, participant_id, amount, received_on, notes")
        .eq("user_id", userId)
        .eq("invoice_month", `${month}-01`),
    ]);
    const closedIds = (closures.data ?? []).map((item) => item.card_id);
    cards = (cardResult.data ?? [])
      .filter((card) => closedIds.includes(card.id))
      .map((card) => ({
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
    receipts = (receiptResult.data ?? []).map((item) => ({
      id: item.id,
      cardId: item.card_id,
      participantId: item.participant_id,
      amount: String(item.amount),
      receivedOn: item.received_on,
      notes: item.notes,
    }));
    if (closedIds.length) {
      const purchaseResult = await supabase
        .from("credit_card_purchases")
        .select(
          "id, card_id, description, amount, purchased_on, invoice_month, installment_number, installment_count, is_recurring, invoice_matched",
        )
        .eq("user_id", userId)
        .eq("invoice_month", `${month}-01`)
        .in("card_id", closedIds);
      const purchaseRows = purchaseResult.data ?? [];
      const splitResult = purchaseRows.length
        ? await supabase
            .from("credit_card_purchase_splits")
            .select("id, purchase_id, participant_id, amount, paid_at")
            .eq("user_id", userId)
            .in(
              "purchase_id",
              purchaseRows.map((item) => item.id),
            )
        : { data: [] };
      const splitMap = new Map<string, PurchaseSplit[]>();
      for (const split of splitResult.data ?? []) {
        const list = splitMap.get(split.purchase_id) ?? [];
        list.push({
          id: split.id,
          participantId: split.participant_id,
          amount: String(split.amount),
          paidAt: split.paid_at,
        });
        splitMap.set(split.purchase_id, list);
      }
      purchases = purchaseRows.map((item) => ({
        id: item.id,
        cardId: item.card_id,
        description: item.description,
        amount: String(item.amount),
        purchasedOn: item.purchased_on,
        invoiceMonth: item.invoice_month.slice(0, 7),
        installmentNumber: item.installment_number,
        installmentCount: item.installment_count,
        isRecurring: item.is_recurring,
        isInvoiceMatched: item.invoice_matched,
        splits: splitMap.get(item.id) ?? [],
      }));
    }
  }
  return (
    <ReconciliationManager
      cards={cards}
      month={month}
      ownerName={ownerName}
      participants={participants}
      purchases={purchases}
      receipts={receipts}
    />
  );
}
