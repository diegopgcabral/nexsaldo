"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { parseCreditCardInput } from "@/lib/financial/credit-card";
import { createClient } from "@/lib/supabase/server";

export type CreditCardActionState = { error?: string; success?: boolean };
const cardIdSchema = z.string().uuid();

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  return typeof userId === "string"
    ? { supabase, userId }
    : { error: "Sua sessão expirou. Entre novamente." };
}

export async function saveCreditCard(
  _previous: CreditCardActionState,
  formData: FormData,
): Promise<CreditCardActionState> {
  const parsed = parseCreditCardInput({
    bank: formData.get("bank"),
    otherBank: formData.get("otherBank"),
    name: formData.get("name"),
    dueDay: formData.get("dueDay"),
  });
  if ("error" in parsed) return { error: parsed.error };

  const rawId = formData.get("id");
  const isEditing = typeof rawId === "string" && rawId.length > 0;
  const id = isEditing ? cardIdSchema.safeParse(rawId) : null;
  if (id && !id.success) return { error: "Cartão inválido." };

  const auth = await getAuthenticatedUser();
  if ("error" in auth) return auth;

  const card = {
    bank_name: parsed.data.bankName,
    name: parsed.data.name,
    due_day: parsed.data.dueDay,
  };
  if (id?.success) {
    const { data, error } = await auth.supabase
      .from("credit_cards")
      .update(card)
      .eq("id", id.data)
      .eq("user_id", auth.userId)
      .select("id")
      .maybeSingle();
    if (error?.code === "23505")
      return { error: "Já existe um cartão com esse nome." };
    if (error || !data)
      return { error: "Não foi possível atualizar este cartão." };
  } else {
    const { error } = await auth.supabase.from("credit_cards").insert({
      ...card,
      user_id: auth.userId,
    });
    if (error?.code === "23505")
      return { error: "Já existe um cartão com esse nome." };
    if (error) return { error: "Não foi possível cadastrar o cartão." };
  }

  revalidatePath("/cards");
  return { success: true };
}

export async function deleteCreditCard(
  id: string,
): Promise<CreditCardActionState> {
  const parsed = cardIdSchema.safeParse(id);
  if (!parsed.success) return { error: "Cartão inválido." };
  const auth = await getAuthenticatedUser();
  if ("error" in auth) return auth;

  const { data, error } = await auth.supabase
    .from("credit_cards")
    .delete()
    .eq("id", parsed.data)
    .eq("user_id", auth.userId)
    .select("id")
    .maybeSingle();
  if (error?.code === "23503")
    return {
      error:
        "Este cartão possui compras e não pode ser excluído. O histórico da fatura foi preservado.",
    };
  if (error || !data) return { error: "Não foi possível excluir este cartão." };

  revalidatePath("/cards");
  return { success: true };
}
