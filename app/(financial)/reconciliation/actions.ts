"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { normalizeCurrencyInput } from "@/lib/financial/contracts";
import { invoiceAmountToCents } from "@/lib/financial/credit-card-invoice";
import { createClient } from "@/lib/supabase/server";

export type ReceiptActionState = { error?: string; success?: boolean };

const receiptSchema = z.object({
  cardId: z.string().uuid(),
  participantId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  amount: z.string().regex(/^\d{1,12}(?:\.\d{1,2})?$/),
  receivedOn: z.iso.date(),
  notes: z.string().trim().max(500).optional(),
});

const settleParticipantSchema = z.object({
  participantId: z.union([z.literal("owner"), z.string().uuid()]),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

function centsToAmount(cents: bigint) {
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
}

export async function registerReceipt(
  input: unknown,
): Promise<ReceiptActionState> {
  const raw = input as Record<string, unknown>;
  const parsed = receiptSchema.safeParse({
    ...raw,
    amount: normalizeCurrencyInput(String(raw.amount ?? "")),
  });
  if (!parsed.success) return { error: "Confira os dados do recebimento." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (typeof userId !== "string") return { error: "Sua sessão expirou." };
  const { error } = await supabase.from("credit_card_receipts").insert({
    user_id: userId,
    card_id: parsed.data.cardId,
    participant_id: parsed.data.participantId,
    invoice_month: `${parsed.data.month}-01`,
    amount: parsed.data.amount,
    received_on: parsed.data.receivedOn,
    notes: parsed.data.notes || null,
  });
  if (error) return { error: "Não foi possível registrar o recebimento." };
  revalidatePath("/reconciliation");
  return { success: true };
}

export async function settleParticipantBalance(
  input: unknown,
): Promise<ReceiptActionState> {
  const parsed = settleParticipantSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados do pagamento inválidos." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (typeof userId !== "string") return { error: "Sua sessão expirou." };

  const invoiceMonth = `${parsed.data.month}-01`;
  const { data: closures, error: closureError } = await supabase
    .from("credit_card_invoice_closures")
    .select("card_id")
    .eq("user_id", userId)
    .eq("invoice_month", invoiceMonth);
  const cardIds = (closures ?? []).map((closure) => closure.card_id);
  if (closureError || !cardIds.length) {
    return { error: "Não há faturas fechadas para conciliar." };
  }

  const { data: purchases, error: purchaseError } = await supabase
    .from("credit_card_purchases")
    .select("id, card_id")
    .eq("user_id", userId)
    .eq("invoice_month", invoiceMonth)
    .in("card_id", cardIds);
  if (purchaseError) return { error: "Não foi possível localizar as compras." };
  const purchaseIds = (purchases ?? []).map((purchase) => purchase.id);
  if (!purchaseIds.length) return { error: "Não há valores em aberto." };

  if (parsed.data.participantId === "owner") {
    const { data: splits, error: splitError } = await supabase
      .from("credit_card_purchase_splits")
      .select("id")
      .eq("user_id", userId)
      .in("purchase_id", purchaseIds)
      .is("participant_id", null)
      .is("paid_at", null);
    if (splitError) return { error: "Não foi possível localizar sua parte das faturas." };
    if (!splits?.length) return { error: "Não há valores em aberto para o titular." };
    for (const split of splits) {
      const { error } = await supabase.rpc("set_credit_card_split_payment", {
        p_split_id: split.id,
        p_is_paid: true,
        p_category: null,
      });
      if (error) return { error: "Não foi possível registrar o pagamento." };
    }
    revalidatePath("/invoices");
    revalidatePath("/expenses");
    revalidatePath("/reconciliation");
    return { success: true };
  }

  const participantId = parsed.data.participantId;
  const purchaseCardIds = new Map((purchases ?? []).map((purchase) => [purchase.id, purchase.card_id]));
  const { data: splits, error: splitError } = await supabase
    .from("credit_card_purchase_splits")
    .select("purchase_id, amount, paid_at")
    .eq("user_id", userId)
    .in("purchase_id", purchaseIds)
    .eq("participant_id", participantId);
  if (splitError) return { error: "Não foi possível localizar a parte do participante." };

  const { data: receipts, error: receiptError } = await supabase
    .from("credit_card_receipts")
    .select("card_id, amount")
    .eq("user_id", userId)
    .eq("participant_id", participantId)
    .eq("invoice_month", invoiceMonth);
  if (receiptError) return { error: "Não foi possível consultar os pagamentos anteriores." };

  const balanceByCard = new Map<string, { due: bigint; settled: bigint }>();
  for (const split of splits ?? []) {
    const cardId = purchaseCardIds.get(split.purchase_id);
    if (!cardId) continue;
    const current = balanceByCard.get(cardId) ?? { due: 0n, settled: 0n };
    current.due += invoiceAmountToCents(String(split.amount));
    if (split.paid_at) current.settled += invoiceAmountToCents(String(split.amount));
    balanceByCard.set(cardId, current);
  }
  for (const receipt of receipts ?? []) {
    const current = balanceByCard.get(receipt.card_id);
    if (current) current.settled += invoiceAmountToCents(String(receipt.amount));
  }
  const receiptRows = Array.from(balanceByCard.entries()).flatMap(([cardId, balance]) => {
    const outstanding = balance.due > balance.settled ? balance.due - balance.settled : 0n;
    return outstanding > 0n ? [{ user_id: userId, card_id: cardId, participant_id: participantId, invoice_month: invoiceMonth, amount: centsToAmount(outstanding), received_on: new Date().toISOString().slice(0, 10), notes: "Pagamento integral pela conciliação" }] : [];
  });
  if (!receiptRows.length) return { error: "Não há valores em aberto para este participante." };
  const { error } = await supabase.from("credit_card_receipts").insert(receiptRows);
  if (error) return { error: "Não foi possível registrar o pagamento." };
  revalidatePath("/reconciliation");
  return { success: true };
}
