import { notFound } from "next/navigation";

import { InvoiceManager } from "@/components/financial/invoice-manager";
import type { CreditCardListItem } from "@/lib/financial/credit-card";
import type {
  PurchaseListItem,
  PurchaseSplit,
} from "@/lib/financial/credit-card-invoice";
import type { InvoiceCycleNote } from "@/lib/financial/invoice-note";
import {
  getCurrentCycleReference,
  isMonthReference,
} from "@/lib/financial/month";
import type { ParticipantListItem } from "@/lib/financial/participant";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{ month?: string }>;

export default async function CardInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ cardId: string }>;
  searchParams: SearchParams;
}) {
  const { cardId } = await params;
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
  let cards: CreditCardListItem[] = [];
  let participants: ParticipantListItem[] = [];
  let purchases: PurchaseListItem[] = [];
  let categories: { name: string; iconKey: string | null }[] = [];
  let notes: InvoiceCycleNote[] = [];
  let isClosed = false;
  let ownerName = "Você";
  let loadError = false;

  if (typeof userId === "string") {
    const [cardResult, participantResult, profileResult, categoryResult] =
      await Promise.all([
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
          .from("expense_categories")
          .select("name, icon_key, is_active")
          .eq("user_id", userId)
          .order("name"),
      ]);
    loadError = Boolean(
      cardResult.error ||
      participantResult.error ||
      profileResult.error ||
      categoryResult.error,
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
    categories = (categoryResult.data ?? [])
      .filter((category) => category.is_active)
      .map((category) => ({
        name: category.name,
        iconKey: category.icon_key,
      }));
    const selectedCard = cards.find((card) => card.id === cardId);
    if (selectedCard) {
      const [purchaseResult, closureResult, noteResult] = await Promise.all([
        supabase
          .from("credit_card_purchases")
          .select(
            "id, card_id, description, amount, purchased_on, invoice_month, installment_number, installment_count, is_recurring, invoice_matched",
          )
          .eq("user_id", userId)
          .eq("card_id", selectedCard.id)
          .eq("invoice_month", `${month}-01`)
          .order("purchased_on", { ascending: false }),
        supabase
          .from("credit_card_invoice_closures")
          .select("card_id")
          .eq("user_id", userId)
          .eq("card_id", selectedCard.id)
          .eq("invoice_month", `${month}-01`)
          .maybeSingle(),
        supabase
          .from("credit_card_invoice_notes")
          .select(
            "id, content, checklist, is_completed, created_at, updated_at",
          )
          .eq("user_id", userId)
          .eq("card_id", selectedCard.id)
          .eq("invoice_month", `${month}-01`)
          .order("updated_at", { ascending: false }),
      ]);
      loadError ||= Boolean(
        purchaseResult.error || closureResult.error || noteResult.error,
      );
      isClosed = Boolean(closureResult.data);
      const purchaseRows = purchaseResult.data ?? [];
      const ids = purchaseRows.map((purchase) => purchase.id);
      const splitsByPurchase = new Map<string, PurchaseSplit[]>();
      if (ids.length > 0) {
        const splitResult = await supabase
          .from("credit_card_purchase_splits")
          .select("id, purchase_id, participant_id, amount, paid_at")
          .eq("user_id", userId)
          .in("purchase_id", ids);
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
      notes = (noteResult.data ?? []).map((note) => ({
        id: note.id,
        content: note.content,
        checklist: Array.isArray(note.checklist) ? note.checklist : [],
        isCompleted: note.is_completed,
        createdAt: note.created_at,
        updatedAt: note.updated_at,
      }));
    }
  }
  const selectedCardId = cards.some((card) => card.id === cardId) ? cardId : "";
  if (!selectedCardId && !loadError) notFound();
  return (
    <InvoiceManager
      cards={cards}
      selectedCardId={selectedCardId}
      month={month}
      participants={participants}
      ownerName={ownerName}
      purchases={purchases}
      loadError={loadError}
      categories={categories}
      isClosed={isClosed}
      notes={notes}
    />
  );
}
