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

function refresh() {
  revalidatePath("/account-division");
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

export async function addManualCharge(input: unknown) {
  const raw = input as Record<string, unknown>;
  const parsed = base
    .extend({
      description: z.string().trim().min(1).max(200),
      dueMonth: month.optional(),
    })
    .safeParse({
      ...raw,
      amount: normalizeCurrencyInput(String(raw.amount ?? "")),
    });
  if (!parsed.success) return { error: "Confira os dados da conta." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (typeof userId !== "string") return { error: "Sua sessão expirou." };
  const { error } = await supabase.from("participant_manual_charges").insert({
    user_id: userId,
    participant_id: parsed.data.participantId,
    reference_month: `${parsed.data.month}-01`,
    description: parsed.data.description,
    amount: parsed.data.amount,
    due_on: parsed.data.dueMonth ? `${parsed.data.dueMonth}-01` : null,
    notes: parsed.data.notes || null,
  });
  if (error) return { error: "Não foi possível adicionar a conta." };
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
    .safeParse({
      ...raw,
      amount: normalizeCurrencyInput(String(raw.amount ?? "")),
    });
  if (!parsed.success) return { error: "Confira os dados da conta." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (typeof userId !== "string") return { error: "Sua sessão expirou." };
  const { error } = await supabase
    .from("participant_manual_charges")
    .update({
      description: parsed.data.description,
      amount: parsed.data.amount,
      due_on: parsed.data.dueMonth ? `${parsed.data.dueMonth}-01` : null,
    })
    .eq("id", parsed.data.id)
    .eq("user_id", userId)
    .eq("participant_id", parsed.data.participantId)
    .eq("reference_month", `${parsed.data.month}-01`);
  if (error) return { error: "Não foi possível atualizar a conta." };
  refresh();
  return { success: true };
}

export async function deleteStatementEntry(id: string) {
  if (!z.string().uuid().safeParse(id).success) return;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (typeof userId !== "string") return;
  await supabase
    .from("participant_manual_charges")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  refresh();
}
