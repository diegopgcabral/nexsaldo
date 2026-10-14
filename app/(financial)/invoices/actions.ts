"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { parsePurchaseInput } from "@/lib/financial/credit-card-invoice";
import { createClient } from "@/lib/supabase/server";

export type PurchaseActionState = { error?: string; success?: boolean };

export async function savePurchase(
  _previous: PurchaseActionState,
  formData: FormData,
): Promise<PurchaseActionState> {
  let input: unknown;
  try {
    input = JSON.parse(String(formData.get("purchase") ?? ""));
  } catch {
    return { error: "Dados da compra inválidos." };
  }
  const parsed = parsePurchaseInput(input);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (typeof userId !== "string")
    return { error: "Sua sessão expirou. Entre novamente." };
  const purchase = parsed.data;
  const { error } = await supabase.rpc("save_credit_card_purchase", {
    p_id: purchase.id,
    p_card_id: purchase.cardId,
    p_description: purchase.description,
    p_amount: purchase.amount,
    p_purchased_on: purchase.purchasedOn,
    p_invoice_month: `${purchase.invoiceMonth}-01`,
    p_splits: purchase.splits,
  });
  if (error)
    return {
      error:
        "Não foi possível salvar a compra. Confira o cartão, os participantes e o rateio.",
    };
  revalidatePath("/invoices");
  return { success: true };
}

export async function deletePurchase(id: string): Promise<PurchaseActionState> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "Compra inválida." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (typeof userId !== "string")
    return { error: "Sua sessão expirou. Entre novamente." };
  const { data, error } = await supabase
    .from("credit_card_purchases")
    .delete()
    .eq("id", parsed.data)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "Não foi possível excluir a compra." };
  revalidatePath("/invoices");
  return { success: true };
}

export async function setSplitPayment(
  splitId: string,
  isPaid: boolean,
  category?: string,
): Promise<PurchaseActionState> {
  const parsedId = z.string().uuid().safeParse(splitId);
  if (!parsedId.success || typeof isPaid !== "boolean")
    return { error: "Parcela inválida." };
  if (
    category !== undefined &&
    (typeof category !== "string" ||
      category.trim().length < 1 ||
      category.trim().length > 100)
  )
    return { error: "Selecione uma categoria válida." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (typeof auth?.claims.sub !== "string")
    return { error: "Sua sessão expirou. Entre novamente." };
  const { error } = await supabase.rpc("set_credit_card_split_payment", {
    p_split_id: parsedId.data,
    p_is_paid: isPaid,
    p_category: category?.trim() || null,
  });
  if (error)
    return { error: "Não foi possível atualizar o pagamento desta parcela." };
  revalidatePath("/invoices");
  revalidatePath("/expenses");
  return { success: true };
}
