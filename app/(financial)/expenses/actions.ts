"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  createExpenseSchema,
  normalizeCurrencyInput,
} from "@/lib/financial/contracts";
import { isMonthReference } from "@/lib/financial/month";
import { createClient } from "@/lib/supabase/server";

export type ExpenseActionState = { error?: string; success?: boolean };
const idSchema = z.string().uuid();
const value = (formData: FormData, name: string) =>
  typeof formData.get(name) === "string" ? String(formData.get(name)) : "";

function payload(formData: FormData) {
  const requestedStatus = value(formData, "status") || "PENDING";
  const normalizedPaidAmount = normalizeCurrencyInput(
    value(formData, "paidAmount") || "0",
  );
  const parsed = createExpenseSchema.safeParse({
    description: value(formData, "description"),
    referenceAmount: normalizeCurrencyInput(value(formData, "referenceAmount")),
    paidAmount:
      requestedStatus === "PENDING" || requestedStatus === "CANCELLED"
        ? "0"
        : normalizedPaidAmount,
    dueDate: value(formData, "dueDate"),
    category: value(formData, "category"),
    status: requestedStatus,
    notes: value(formData, "notes") || undefined,
    isRecurring: value(formData, "isRecurring") === "on",
  });
  if (!parsed.success) return parsed;

  return {
    data: parsed.data,
    success: true as const,
  };
}

function paymentDate(
  status: "PENDING" | "PAID" | "CANCELLED",
  dueDate: string,
) {
  return status === "PAID" ? dueDate : null;
}

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  return typeof userId === "string"
    ? { supabase, userId }
    : { error: "Sua sessão expirou. Entre novamente para continuar." };
}

function refresh(month: string) {
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  if (isMonthReference(month)) revalidatePath(`/expenses?month=${month}`);
}

export async function createExpense(
  _: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const parsed = payload(formData);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const auth = await session();
  if ("error" in auth) return auth;
  const { error } = await auth.supabase.rpc("save_expense", {
    p_id: null,
    p_description: parsed.data.description,
    p_reference_amount: parsed.data.referenceAmount,
    p_paid_amount: parsed.data.paidAmount,
    p_due_date: parsed.data.dueDate,
    p_paid_at: paymentDate(parsed.data.status, parsed.data.dueDate),
    p_category: parsed.data.category,
    p_status: parsed.data.status,
    p_notes: parsed.data.notes ?? null,
    p_is_recurring: parsed.data.isRecurring,
  });
  if (error) return { error: "Não foi possível salvar a despesa." };
  refresh(value(formData, "month"));
  return { success: true };
}

export async function updateExpense(
  _: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const id = idSchema.safeParse(value(formData, "id"));
  const parsed = payload(formData);
  if (!id.success) return { error: "Despesa inválida." };
  if (!parsed.success)
    return { error: parsed.error?.issues[0]?.message ?? "Dados inválidos." };
  const auth = await session();
  if ("error" in auth) return auth;
  const { error } = await auth.supabase.rpc("save_expense", {
    p_id: id.data,
    p_description: parsed.data.description,
    p_reference_amount: parsed.data.referenceAmount,
    p_paid_amount: parsed.data.paidAmount,
    p_due_date: parsed.data.dueDate,
    p_paid_at: paymentDate(parsed.data.status, parsed.data.dueDate),
    p_category: parsed.data.category,
    p_status: parsed.data.status,
    p_notes: parsed.data.notes ?? null,
    p_is_recurring: parsed.data.isRecurring,
  });
  if (error) return { error: "Não foi possível atualizar a despesa." };
  refresh(value(formData, "month"));
  return { success: true };
}

export async function deleteExpense(
  formData: FormData,
): Promise<ExpenseActionState> {
  const id = idSchema.safeParse(value(formData, "id"));
  if (!id.success) return { error: "Despesa inválida." };
  const auth = await session();
  if ("error" in auth) return auth;
  const { error } = await auth.supabase
    .from("expenses")
    .delete()
    .eq("id", id.data)
    .eq("user_id", auth.userId);
  if (error) return { error: "Não foi possível excluir a despesa." };
  refresh(value(formData, "month"));
  return { success: true };
}
