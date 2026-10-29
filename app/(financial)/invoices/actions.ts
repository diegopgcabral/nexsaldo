"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { parsePurchaseInput } from "@/lib/financial/credit-card-invoice";
import { createClient } from "@/lib/supabase/server";

export type PurchaseActionState = { error?: string; success?: boolean };

const noteInput = z.object({
  id: z.string().uuid().optional(),
  cardId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  content: z.string().trim().max(10000),
  checklist: z
    .array(
      z.object({
        id: z.string().uuid(),
        text: z.string().trim().min(1).max(280),
        checked: z.boolean(),
      }),
    )
    .max(100),
});

async function noteSession() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  return typeof auth?.claims.sub === "string"
    ? { supabase, userId: auth.claims.sub }
    : null;
}

export async function saveInvoiceCycleNote(input: unknown) {
  const parsed = noteInput.safeParse(input);
  if (
    !parsed.success ||
    (!parsed.data.content && !parsed.data.checklist.length)
  )
    return { error: "Escreva uma nota ou adicione um item à checklist." };
  const session = await noteSession();
  if (!session) return { error: "Sua sessão expirou. Entre novamente." };
  const values = {
    user_id: session.userId,
    card_id: parsed.data.cardId,
    invoice_month: `${parsed.data.month}-01`,
    content: parsed.data.content,
    checklist: parsed.data.checklist,
  };
  const query = parsed.data.id
    ? session.supabase
        .from("credit_card_invoice_notes")
        .update(values)
        .eq("id", parsed.data.id)
        .eq("user_id", session.userId)
    : session.supabase.from("credit_card_invoice_notes").insert(values);
  const { error } = await query;
  if (error) return { error: "Não foi possível salvar a nota." };
  revalidatePath(`/invoices/${parsed.data.cardId}`);
  return { success: true };
}

export async function setInvoiceCycleNoteCompleted(input: unknown) {
  const parsed = z
    .object({
      id: z.string().uuid(),
      cardId: z.string().uuid(),
      completed: z.boolean(),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Nota inválida." };
  const session = await noteSession();
  if (!session) return { error: "Sua sessão expirou. Entre novamente." };
  const { error } = await session.supabase
    .from("credit_card_invoice_notes")
    .update({
      is_completed: parsed.data.completed,
      completed_at: parsed.data.completed ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.id)
    .eq("user_id", session.userId);
  if (error) return { error: "Não foi possível atualizar a nota." };
  revalidatePath(`/invoices/${parsed.data.cardId}`);
  return { success: true };
}

export async function deleteInvoiceCycleNote(input: unknown) {
  const parsed = z
    .object({ id: z.string().uuid(), cardId: z.string().uuid() })
    .safeParse(input);
  if (!parsed.success) return { error: "Nota inválida." };
  const session = await noteSession();
  if (!session) return { error: "Sua sessão expirou. Entre novamente." };
  const { error } = await session.supabase
    .from("credit_card_invoice_notes")
    .delete()
    .eq("id", parsed.data.id)
    .eq("user_id", session.userId);
  if (error) return { error: "Não foi possível excluir a nota." };
  revalidatePath(`/invoices/${parsed.data.cardId}`);
  return { success: true };
}

function invoiceError(error: { message?: string } | null, fallback: string) {
  return error?.message?.includes("Invoice is closed")
    ? "Esta fatura está fechada e não pode receber alterações."
    : fallback;
}

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
    p_purchased_on: purchase.purchasedOn ?? null,
    p_invoice_month: `${purchase.invoiceMonth}-01`,
    p_splits: purchase.splits,
    p_installment_number: purchase.installmentNumber,
    p_installment_count: purchase.installmentCount,
    p_is_recurring: purchase.isRecurring,
  });
  if (error)
    return {
      error: invoiceError(
        error,
        "Não foi possível salvar a compra. Confira o cartão, os participantes e o rateio.",
      ),
    };
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${purchase.cardId}`);
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
  if (error || !data)
    return { error: invoiceError(error, "Não foi possível excluir a compra.") };
  revalidatePath("/invoices");
  return { success: true };
}

export async function movePurchaseToNextInvoice(
  purchaseId: string,
): Promise<PurchaseActionState> {
  const id = z.string().uuid().safeParse(purchaseId);
  if (!id.success) return { error: "Compra inválida." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (typeof auth?.claims.sub !== "string")
    return { error: "Sua sessão expirou. Entre novamente." };
  const { error } = await supabase.rpc(
    "move_credit_card_purchase_to_next_invoice",
    { p_purchase_id: id.data },
  );
  if (error)
    return { error: invoiceError(error, "Não foi possível mover a compra.") };
  revalidatePath("/invoices");
  return { success: true };
}

export async function setPurchaseInvoiceMatch(
  purchaseId: string,
  isMatched: boolean,
): Promise<PurchaseActionState> {
  const id = z.string().uuid().safeParse(purchaseId);
  if (!id.success || typeof isMatched !== "boolean")
    return { error: "Compra inválida." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (typeof userId !== "string")
    return { error: "Sua sessão expirou. Entre novamente." };
  const { data, error } = await supabase
    .from("credit_card_purchases")
    .update({ invoice_matched: isMatched })
    .eq("id", id.data)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error || !data)
    return {
      error: invoiceError(error, "Não foi possível atualizar a conferência."),
    };
  revalidatePath("/invoices");
  return { success: true };
}

export async function closeInvoice(
  cardId: string,
  month: string,
): Promise<PurchaseActionState> {
  const id = z.string().uuid().safeParse(cardId);
  if (!id.success || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    return { error: "Fatura inválida." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (typeof auth?.claims.sub !== "string")
    return { error: "Sua sessão expirou. Entre novamente." };
  const { error } = await supabase.rpc("close_credit_card_invoice", {
    p_card_id: id.data,
    p_invoice_month: `${month}-01`,
  });
  if (error) return { error: "Não foi possível fechar a fatura." };
  revalidatePath("/invoices");
  return { success: true };
}

export async function reopenInvoice(
  cardId: string,
  month: string,
): Promise<PurchaseActionState> {
  const id = z.string().uuid().safeParse(cardId);
  if (!id.success || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    return { error: "Fatura inválida." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (typeof userId !== "string")
    return { error: "Sua sessão expirou. Entre novamente." };
  const { data, error } = await supabase
    .from("credit_card_invoice_closures")
    .delete()
    .eq("card_id", id.data)
    .eq("user_id", userId)
    .eq("invoice_month", `${month}-01`)
    .select("card_id")
    .maybeSingle();
  if (error || !data) return { error: "Não foi possível reabrir a fatura." };
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
