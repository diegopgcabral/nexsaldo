"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { normalizeCurrencyInput } from "@/lib/financial/contracts";
import { createClient } from "@/lib/supabase/server";

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const base = z.object({
  participantId: z.string().uuid(),
  month,
  amount: z.string().regex(/^\d{1,12}(?:\.\d{1,2})?$/),
  notes: z.string().trim().max(500).optional(),
});
const installments = z
  .object({
    installmentNumber: z.coerce.number().int().min(1).max(120),
    installmentCount: z.coerce.number().int().min(1).max(120),
  })
  .refine((value) => value.installmentNumber <= value.installmentCount, {
    message: "A parcela atual não pode ser maior que o total.",
    path: ["installmentNumber"],
  });

const recurring = z.object({
  isRecurring: z.boolean(),
});

function refresh() {
  revalidatePath("/account-division");
}

function statementError(error: { message?: string } | null, fallback: string) {
  return error?.message?.includes("Statement is finalized")
    ? "Esta divisão está finalizada. Reabra-a para alterar as contas."
    : fallback;
}

export async function confirmVisualStatementPayment(input: unknown) {
  const parsed = z
    .object({ participantId: z.string().uuid(), month })
    .safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (typeof userId !== "string") return { error: "Sua sessão expirou." };
  const referenceMonth = `${parsed.data.month}-01`;
  const { data: existing, error: lookupError } = await supabase
    .from("participant_statement_visual_payment_statuses")
    .select("id")
    .eq("user_id", userId)
    .eq("participant_id", parsed.data.participantId)
    .eq("reference_month", referenceMonth)
    .maybeSingle();
  if (lookupError) return { error: "Não foi possível confirmar o pagamento." };
  if (!existing) {
    const { error } = await supabase
      .from("participant_statement_visual_payment_statuses")
      .insert({
        user_id: userId,
        participant_id: parsed.data.participantId,
        reference_month: referenceMonth,
      });
    if (error) return { error: "Não foi possível confirmar o pagamento." };
  }
  revalidatePath("/account-division");
  revalidatePath(`/account-division/${parsed.data.participantId}`);
  return { success: true };
}

export async function undoVisualStatementPayment(input: unknown) {
  const parsed = z
    .object({ participantId: z.string().uuid(), month })
    .safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (typeof userId !== "string") return { error: "Sua sessão expirou." };
  const { error } = await supabase
    .from("participant_statement_visual_payment_statuses")
    .delete()
    .eq("user_id", userId)
    .eq("participant_id", parsed.data.participantId)
    .eq("reference_month", `${parsed.data.month}-01`);
  if (error) return { error: "Não foi possível desfazer o pagamento." };
  revalidatePath("/account-division");
  revalidatePath(`/account-division/${parsed.data.participantId}`);
  return { success: true };
}

export async function finalizeStatement(input: unknown) {
  const parsed = z
    .object({ participantId: z.string().uuid(), month })
    .safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (typeof userId !== "string") return { error: "Sua sessão expirou." };
  const { data: closure, error } = await supabase
    .from("participant_statement_closures")
    .insert({
      user_id: userId,
      participant_id: parsed.data.participantId,
      reference_month: `${parsed.data.month}-01`,
    })
    .select("id")
    .maybeSingle();
  if (error && error.code !== "23505") {
    console.error("Could not finalize participant statement", error);
    return { error: "Não foi possível finalizar a divisão." };
  }
  if (!closure && error?.code === "23505") {
    const { data: existing, error: lookupError } = await supabase
      .from("participant_statement_closures")
      .select("id")
      .eq("user_id", userId)
      .eq("participant_id", parsed.data.participantId)
      .eq("reference_month", `${parsed.data.month}-01`)
      .maybeSingle();
    if (lookupError || !existing) {
      console.error("Could not verify finalized participant statement", {
        lookupError,
        participantId: parsed.data.participantId,
        referenceMonth: parsed.data.month,
      });
      return { error: "Não foi possível confirmar a finalização da divisão." };
    }
  }
  revalidatePath("/account-division");
  revalidatePath(`/account-division/${parsed.data.participantId}`);
  return { success: true };
}

export async function reopenStatement(input: unknown) {
  const parsed = z
    .object({ participantId: z.string().uuid(), month })
    .safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (typeof userId !== "string") return { error: "Sua sessão expirou." };
  const { error } = await supabase
    .from("participant_statement_closures")
    .delete()
    .eq("user_id", userId)
    .eq("participant_id", parsed.data.participantId)
    .eq("reference_month", `${parsed.data.month}-01`);
  if (error) return { error: "Não foi possível reabrir a divisão." };
  revalidatePath("/account-division");
  revalidatePath(`/account-division/${parsed.data.participantId}`);
  return { success: true };
}

export async function addManualCharge(input: unknown) {
  const raw = input as Record<string, unknown>;
  const parsed = base
    .extend({
      description: z.string().trim().min(1).max(200),
      dueMonth: month.optional(),
    })
    .and(installments)
    .and(recurring)
    .safeParse({
      ...raw,
      amount: normalizeCurrencyInput(String(raw.amount ?? "")),
      isRecurring: raw.isRecurring === "true",
    });
  if (!parsed.success) {
    const installmentIssue = parsed.error.issues.find(
      (issue) => issue.path[0] === "installmentNumber",
    );
    return { error: installmentIssue?.message ?? "Confira os dados da conta." };
  }
  if (parsed.data.isRecurring && parsed.data.installmentCount !== 1) {
    return { error: "Uma conta recorrente não pode ter parcelas." };
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (typeof userId !== "string") return { error: "Sua sessão expirou." };
  const { error } = await supabase.rpc("save_participant_manual_charge", {
    p_id: null,
    p_participant_id: parsed.data.participantId,
    p_reference_month: `${parsed.data.month}-01`,
    p_description: parsed.data.description,
    p_amount: parsed.data.amount,
    p_due_on: parsed.data.dueMonth ? `${parsed.data.dueMonth}-01` : null,
    p_notes: parsed.data.notes || null,
    p_installment_number: parsed.data.installmentNumber,
    p_installment_count: parsed.data.installmentCount,
    p_is_recurring: parsed.data.isRecurring,
  });
  if (error)
    return {
      error: statementError(error, "Não foi possível adicionar a conta."),
    };
  refresh();
  return { success: true };
}

export async function updateManualCharge(input: unknown) {
  const raw = input as Record<string, unknown>;
  const parsed = base
    .extend({
      id: z.string().uuid(),
      description: z.string().trim().min(1).max(200),
      dueMonth: month.optional(),
    })
    .and(installments)
    .and(recurring)
    .safeParse({
      ...raw,
      amount: normalizeCurrencyInput(String(raw.amount ?? "")),
      isRecurring: raw.isRecurring === "true",
    });
  if (!parsed.success) return { error: "Confira os dados da conta." };
  if (parsed.data.isRecurring && parsed.data.installmentCount !== 1) {
    return { error: "Uma conta recorrente não pode ter parcelas." };
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (typeof userId !== "string") return { error: "Sua sessão expirou." };
  const { error } = await supabase.rpc("save_participant_manual_charge", {
    p_id: parsed.data.id,
    p_participant_id: parsed.data.participantId,
    p_reference_month: `${parsed.data.month}-01`,
    p_description: parsed.data.description,
    p_amount: parsed.data.amount,
    p_due_on: parsed.data.dueMonth ? `${parsed.data.dueMonth}-01` : null,
    p_notes: parsed.data.notes || null,
    p_installment_number: parsed.data.installmentNumber,
    p_installment_count: parsed.data.installmentCount,
    p_is_recurring: parsed.data.isRecurring,
  });
  if (error)
    return {
      error: statementError(error, "Não foi possível atualizar a conta."),
    };
  refresh();
  return { success: true };
}

export async function deleteStatementEntry(id: string) {
  if (!z.string().uuid().safeParse(id).success) return;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (typeof userId !== "string") return;
  const { error } = await supabase
    .from("participant_manual_charges")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error)
    return {
      error: statementError(error, "Não foi possível excluir a conta."),
    };
  refresh();
  return { success: true };
}
