"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { expenseCategoryIconKeys } from "@/lib/financial/category";
import {
  navigationModuleKeys,
  type NavigationModules,
} from "@/lib/financial/navigation-modules";
import { createClient } from "@/lib/supabase/server";

export type SettingsActionState = { error?: string; success?: boolean };
const categoryIdSchema = z.string().uuid();
const categoryIconKeySchema = z.enum(expenseCategoryIconKeys);

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  return typeof userId === "string"
    ? { supabase, userId }
    : { error: "Sua sessão expirou." };
}

function revalidateCategoryPages() {
  revalidatePath("/settings");
  revalidatePath("/expenses");
}

export async function saveNavigationModules(
  _previous: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const modules = navigationModuleKeys.reduce<NavigationModules>(
    (result, key) => ({ ...result, [key]: formData.get(key) === "on" }),
    {} as NavigationModules,
  );
  const auth = await getAuthenticatedUser();
  if ("error" in auth) return auth;
  const { error } = await auth.supabase
    .from("profiles")
    .update({ navigation_modules: modules })
    .eq("id", auth.userId);
  if (error) return { error: "Não foi possível salvar os menus." };
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function saveFinancialCycle(
  _previous: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const result = z.coerce
    .number()
    .int()
    .min(1)
    .max(31)
    .safeParse(formData.get("startDay"));
  if (!result.success) return { error: "Escolha um dia entre 1 e 31." };
  const auth = await getAuthenticatedUser();
  if ("error" in auth) return auth;
  const { error } = await auth.supabase
    .from("profiles")
    .update({ financial_cycle_start_day: result.data })
    .eq("id", auth.userId);
  if (error) return { error: "Não foi possível salvar suas configurações." };
  revalidatePath("/settings");
  revalidatePath("/income");
  revalidatePath("/expenses");
  return { success: true };
}

export async function createExpenseCategory(
  _previous: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const name = z
    .string()
    .trim()
    .min(1)
    .max(100)
    .safeParse(formData.get("name"));
  if (!name.success) return { error: "Informe um nome de categoria válido." };
  const auth = await getAuthenticatedUser();
  if ("error" in auth) return auth;
  const { error } = await auth.supabase
    .from("expense_categories")
    .insert({ user_id: auth.userId, name: name.data });
  if (error?.code === "23505") return { error: "Essa categoria já existe." };
  if (error) return { error: "Não foi possível criar a categoria." };
  revalidateCategoryPages();
  return { success: true };
}

export async function deactivateExpenseCategory(
  categoryId: string,
): Promise<SettingsActionState> {
  const id = categoryIdSchema.safeParse(categoryId);
  if (!id.success) return { error: "Categoria inválida." };
  const auth = await getAuthenticatedUser();
  if ("error" in auth) return auth;
  const { data, error } = await auth.supabase
    .from("expense_categories")
    .update({ is_active: false })
    .eq("id", id.data)
    .eq("user_id", auth.userId)
    .eq("is_active", true)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { error: "Não foi possível desativar a categoria." };
  }
  revalidateCategoryPages();
  return { success: true };
}

export async function activateExpenseCategory(
  categoryId: string,
): Promise<SettingsActionState> {
  const id = categoryIdSchema.safeParse(categoryId);
  if (!id.success) return { error: "Categoria inválida." };
  const auth = await getAuthenticatedUser();
  if ("error" in auth) return auth;
  const { data, error } = await auth.supabase
    .from("expense_categories")
    .update({ is_active: true })
    .eq("id", id.data)
    .eq("user_id", auth.userId)
    .eq("is_active", false)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { error: "Não foi possível ativar a categoria." };
  }
  revalidateCategoryPages();
  return { success: true };
}

export async function deleteExpenseCategory(
  categoryId: string,
): Promise<SettingsActionState> {
  const id = categoryIdSchema.safeParse(categoryId);
  if (!id.success) return { error: "Categoria inválida." };
  const auth = await getAuthenticatedUser();
  if ("error" in auth) return auth;
  const { data, error } = await auth.supabase
    .from("expense_categories")
    .delete()
    .eq("id", id.data)
    .eq("user_id", auth.userId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { error: "Não foi possível excluir a categoria." };
  }
  revalidateCategoryPages();
  return { success: true };
}

export async function updateExpenseCategoryIcon(
  categoryId: string,
  iconKey: string,
): Promise<SettingsActionState> {
  const id = categoryIdSchema.safeParse(categoryId);
  const icon = categoryIconKeySchema.safeParse(iconKey);
  if (!id.success || !icon.success) return { error: "Ícone inválido." };
  const auth = await getAuthenticatedUser();
  if ("error" in auth) return auth;
  const { data, error } = await auth.supabase
    .from("expense_categories")
    .update({ icon_key: icon.data })
    .eq("id", id.data)
    .eq("user_id", auth.userId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { error: "Não foi possível salvar o ícone da categoria." };
  }
  revalidateCategoryPages();
  return { success: true };
}
