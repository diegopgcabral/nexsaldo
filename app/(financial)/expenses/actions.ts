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
const paymentProofBucket = "expense-payment-proofs";
const maxPaymentProofBytes = 5 * 1024 * 1024;
const paymentProofTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const value = (formData: FormData, name: string) =>
  typeof formData.get(name) === "string" ? String(formData.get(name)) : "";

function payload(formData: FormData) {
  const isRecurring = value(formData, "isRecurring") === "on";
  const requestedStatus = isRecurring
    ? value(formData, "status") || "PENDING"
    : "PAID";
  const normalizedPaidAmount = normalizeCurrencyInput(
    value(formData, "paidAmount") || "0",
  );
  const parsed = createExpenseSchema.safeParse({
    description: value(formData, "description"),
    referenceAmount: isRecurring
      ? normalizeCurrencyInput(value(formData, "referenceAmount") || "0")
      : normalizedPaidAmount,
    paidAmount:
      requestedStatus === "PENDING" || requestedStatus === "CANCELLED"
        ? "0"
        : normalizedPaidAmount,
    dueDate: value(formData, "dueDate"),
    category: value(formData, "category"),
    status: requestedStatus,
    notes: value(formData, "notes") || undefined,
    isRecurring,
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

function paymentProofFrom(formData: FormData) {
  const entry = formData.get("paymentProof");
  if (!(entry instanceof File) || entry.size === 0) {
    return { file: null } as const;
  }
  if (!paymentProofTypes.has(entry.type)) {
    return { error: "Envie um comprovante em PDF, JPG, PNG ou WEBP." } as const;
  }
  if (entry.size > maxPaymentProofBytes) {
    return { error: "O comprovante deve ter no máximo 5 MB." } as const;
  }
  return { file: entry } as const;
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "comprovante";
}

async function removePaymentProof(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  expenseId: string,
) {
  const { data: proof } = await supabase
    .from("expense_payment_proofs")
    .select("storage_path")
    .eq("expense_id", expenseId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!proof) return;

  const { error: databaseError } = await supabase
    .from("expense_payment_proofs")
    .delete()
    .eq("expense_id", expenseId)
    .eq("user_id", userId);
  if (databaseError) throw new Error("Não foi possível remover o comprovante.");

  const { error: storageError } = await supabase.storage
    .from(paymentProofBucket)
    .remove([proof.storage_path]);
  if (storageError) throw new Error("Não foi possível remover o arquivo do comprovante.");
}

async function savePaymentProof(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  expenseId: string,
  file: File,
) {
  const { data: currentProof } = await supabase
    .from("expense_payment_proofs")
    .select("storage_path")
    .eq("expense_id", expenseId)
    .eq("user_id", userId)
    .maybeSingle();
  const storagePath = `${userId}/${expenseId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from(paymentProofBucket)
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) throw new Error("Não foi possível enviar o comprovante.");

  const { error: databaseError } = await supabase
    .from("expense_payment_proofs")
    .upsert(
      {
        expense_id: expenseId,
        user_id: userId,
        storage_path: storagePath,
        original_file_name: file.name.slice(0, 255),
        content_type: file.type,
        size_bytes: file.size,
      },
      { onConflict: "expense_id" },
    );
  if (databaseError) {
    await supabase.storage.from(paymentProofBucket).remove([storagePath]);
    throw new Error("Não foi possível registrar o comprovante.");
  }
  if (currentProof?.storage_path) {
    await supabase.storage
      .from(paymentProofBucket)
      .remove([currentProof.storage_path]);
  }
}

async function saveProofForExpense(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  expenseId: string,
  status: "PENDING" | "PAID" | "CANCELLED",
  formData: FormData,
) {
  const proof = paymentProofFrom(formData);
  if ("error" in proof) throw new Error(proof.error);
  if (status !== "PAID" || value(formData, "removePaymentProof") === "on") {
    await removePaymentProof(supabase, userId, expenseId);
    return;
  }
  if (proof.file) await savePaymentProof(supabase, userId, expenseId, proof.file);
}

export async function createExpense(
  _: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const parsed = payload(formData);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const proof = paymentProofFrom(formData);
  if ("error" in proof) return proof;
  const auth = await session();
  if ("error" in auth) return auth;
  const { data: expenseId, error } = await auth.supabase.rpc("save_expense", {
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
  try {
    await saveProofForExpense(
      auth.supabase,
      auth.userId,
      expenseId,
      parsed.data.status,
      formData,
    );
  } catch (proofError) {
    return {
      error:
        proofError instanceof Error
          ? proofError.message
          : "A despesa foi salva, mas o comprovante não pôde ser enviado.",
    };
  }
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
  const proof = paymentProofFrom(formData);
  if ("error" in proof) return proof;
  const auth = await session();
  if ("error" in auth) return auth;
  const { data: expenseId, error } = await auth.supabase.rpc("save_expense", {
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
  try {
    await saveProofForExpense(
      auth.supabase,
      auth.userId,
      expenseId,
      parsed.data.status,
      formData,
    );
  } catch (proofError) {
    return {
      error:
        proofError instanceof Error
          ? proofError.message
          : "A despesa foi atualizada, mas o comprovante não pôde ser enviado.",
    };
  }
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
  const { data: expense, error: lookupError } = await auth.supabase
    .from("expenses")
    .select("recurring_expense_id")
    .eq("id", id.data)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (lookupError || !expense) return { error: "Despesa não encontrada." };

  try {
    await removePaymentProof(auth.supabase, auth.userId, id.data);
  } catch (proofError) {
    return {
      error:
        proofError instanceof Error
          ? proofError.message
          : "Não foi possível remover o comprovante.",
    };
  }

  if (expense.recurring_expense_id) {
    const { error } = await auth.supabase
      .from("recurring_expenses")
      .update({ is_active: false })
      .eq("id", expense.recurring_expense_id)
      .eq("user_id", auth.userId);
    if (error)
      return { error: "Não foi possível cancelar a conta recorrente." };

    const { error: futureError } = await auth.supabase
      .from("expenses")
      .delete()
      .eq("user_id", auth.userId)
      .eq("recurring_expense_id", expense.recurring_expense_id)
      .eq("status", "PENDING");
    if (futureError)
      return {
        error:
          "A conta foi cancelada, mas não foi possível remover as próximas ocorrências.",
      };
    refresh(value(formData, "month"));
    return { success: true };
  }
  const { error } = await auth.supabase
    .from("expenses")
    .delete()
    .eq("id", id.data)
    .eq("user_id", auth.userId);
  if (error) return { error: "Não foi possível excluir a despesa." };
  refresh(value(formData, "month"));
  return { success: true };
}
