import {
  AccountDivisionManager,
  type ParticipantStatementSummary,
} from "@/components/financial/account-division-manager";
import { invoiceAmountToCents } from "@/lib/financial/credit-card-invoice";
import {
  getCurrentMonthReference,
  isMonthReference,
} from "@/lib/financial/month";
import type { ParticipantListItem } from "@/lib/financial/participant";
import { createClient } from "@/lib/supabase/server";

export default async function AccountDivisionPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const query = await searchParams;
  const month = isMonthReference(query.month ?? null)
    ? query.month!
    : getCurrentMonthReference();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  let summaries: ParticipantStatementSummary[] = [];
  if (typeof userId === "string") {
    const [
      peopleResult,
      profileResult,
      purchaseResult,
      chargeResult,
      statusResult,
      closureResult,
    ] = await Promise.all([
      supabase
        .from("credit_card_participants")
        .select("id, name, phone, is_active, is_owner")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("profiles")
        .select("credit_card_owner_name, display_name")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("credit_card_purchases")
        .select("id")
        .eq("user_id", userId)
        .eq("invoice_month", `${month}-01`),
      supabase
        .from("participant_manual_charges")
        .select("participant_id, amount")
        .eq("user_id", userId)
        .eq("reference_month", `${month}-01`),
      supabase
        .from("participant_statement_visual_payment_statuses")
        .select("participant_id")
        .eq("user_id", userId)
        .eq("reference_month", `${month}-01`),
      supabase
        .from("participant_statement_closures")
        .select("participant_id")
        .eq("user_id", userId)
        .eq("reference_month", `${month}-01`),
    ]);
    const participants: ParticipantListItem[] = (peopleResult.data ?? []).map(
      (person) => ({
        id: person.id,
        name: person.is_owner
          ? profileResult.data?.credit_card_owner_name ||
            profileResult.data?.display_name ||
            "Titular"
          : person.name,
        phone: person.phone,
        isActive: person.is_active,
        isOwner: person.is_owner,
      }),
    );
    participants.sort(
      (left, right) => Number(right.isOwner) - Number(left.isOwner),
    );
    const ownerParticipant = participants.find(
      (participant) => participant.isOwner,
    );
    const purchaseIds = (purchaseResult.data ?? []).map((item) => item.id);
    const { data: splits } = purchaseIds.length
      ? await supabase
          .from("credit_card_purchase_splits")
          .select("participant_id, amount")
          .eq("user_id", userId)
          .in("purchase_id", purchaseIds)
      : { data: [] };
    const cardTotals = new Map<string, bigint>();
    for (const split of splits ?? []) {
      const participantId = split.participant_id ?? ownerParticipant?.id;
      if (participantId)
        cardTotals.set(
          participantId,
          (cardTotals.get(participantId) ?? 0n) +
            invoiceAmountToCents(String(split.amount)),
        );
    }
    const manualTotals = new Map<string, bigint>();
    for (const charge of chargeResult.data ?? [])
      manualTotals.set(
        charge.participant_id,
        (manualTotals.get(charge.participant_id) ?? 0n) +
          invoiceAmountToCents(String(charge.amount)),
      );
    const paidParticipantIds = new Set(
      (statusResult.data ?? []).map((status) => status.participant_id),
    );
    const finalizedParticipantIds = new Set(
      (closureResult.data ?? []).map((closure) => closure.participant_id),
    );
    summaries = participants.map((participant) => ({
      participant,
      cardsCents: cardTotals.get(participant.id) ?? 0n,
      manualCents: manualTotals.get(participant.id) ?? 0n,
      isPaymentConfirmed: paidParticipantIds.has(participant.id),
      isFinalized: finalizedParticipantIds.has(participant.id),
    }));
  }
  return <AccountDivisionManager month={month} summaries={summaries} />;
}
