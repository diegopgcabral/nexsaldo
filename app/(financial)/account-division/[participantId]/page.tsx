import { notFound } from "next/navigation";

import { AccountDivisionDetail } from "@/components/financial/account-division-manager";
import type {
  StatementManualCharge,
  StatementPurchase,
} from "@/lib/financial/account-division";
import {
  getCurrentMonthReference,
  isMonthReference,
} from "@/lib/financial/month";
import type { ParticipantListItem } from "@/lib/financial/participant";
import { createClient } from "@/lib/supabase/server";

export default async function AccountDivisionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ participantId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const [{ participantId }, query] = await Promise.all([params, searchParams]);
  const month = isMonthReference(query.month ?? null)
    ? query.month!
    : getCurrentMonthReference();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (typeof userId !== "string") notFound();
  const { data: person } = await supabase
    .from("credit_card_participants")
    .select("id, name, phone, is_active, is_owner")
    .eq("id", participantId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!person) notFound();
  const { data: profile } = person.is_owner
    ? await supabase
        .from("profiles")
        .select("credit_card_owner_name, display_name")
        .eq("id", userId)
        .maybeSingle()
    : { data: null };
  const participant: ParticipantListItem = {
    id: person.id,
    name:
      profile?.credit_card_owner_name || profile?.display_name || person.name,
    phone: person.phone,
    isActive: person.is_active,
    isOwner: person.is_owner,
  };
  const [purchaseResult, cardResult, chargeResult, closureResult] =
    await Promise.all([
      supabase
        .from("credit_card_purchases")
        .select(
          "id, card_id, description, purchased_on, installment_number, installment_count, is_recurring",
        )
        .eq("user_id", userId)
        .eq("invoice_month", `${month}-01`),
      supabase
        .from("credit_cards")
        .select("id, name, bank_name")
        .eq("user_id", userId),
      supabase
        .from("participant_manual_charges")
        .select(
          "id, description, amount, due_on, notes, installment_number, installment_count, is_recurring",
        )
        .eq("user_id", userId)
        .eq("participant_id", participantId)
        .eq("reference_month", `${month}-01`)
        .order("created_at"),
      supabase
        .from("participant_statement_closures")
        .select("id")
        .eq("user_id", userId)
        .eq("participant_id", participantId)
        .eq("reference_month", `${month}-01`)
        .maybeSingle(),
    ]);
  const purchaseRows = purchaseResult.data ?? [];
  const cardMap = new Map(
    (cardResult.data ?? []).map((card) => [card.id, card]),
  );
  const splitQuery = supabase
    .from("credit_card_purchase_splits")
    .select("purchase_id, amount")
    .eq("user_id", userId)
    .in(
      "purchase_id",
      purchaseRows.map((purchase) => purchase.id),
    );
  const { data: splits } = purchaseRows.length
    ? person.is_owner
      ? await splitQuery.is("participant_id", null)
      : await splitQuery.eq("participant_id", participantId)
    : { data: [] };
  const splitMap = new Map(
    (splits ?? []).map((split) => [split.purchase_id, String(split.amount)]),
  );
  const purchases: StatementPurchase[] = purchaseRows.flatMap((purchase) => {
    const amount = splitMap.get(purchase.id);
    const card = cardMap.get(purchase.card_id);
    return amount && card
      ? [
          {
            cardId: card.id,
            cardName: card.name,
            cardBankName: card.bank_name,
            cardLastFour: null,
            description: purchase.description,
            amount,
            purchasedOn: purchase.purchased_on,
            installmentNumber: purchase.installment_number,
            installmentCount: purchase.installment_count,
            isRecurring: purchase.is_recurring,
          },
        ]
      : [];
  });
  const manualCharges: StatementManualCharge[] = (chargeResult.data ?? []).map(
    (charge) => ({
      id: charge.id,
      description: charge.description,
      amount: String(charge.amount),
      dueOn: charge.due_on,
      notes: charge.notes,
      installmentNumber: charge.installment_number,
      installmentCount: charge.installment_count,
      isRecurring: charge.is_recurring,
    }),
  );
  return (
    <AccountDivisionDetail
      month={month}
      participant={participant}
      purchases={purchases}
      manualCharges={manualCharges}
      isFinalized={Boolean(closureResult.data)}
    />
  );
}
