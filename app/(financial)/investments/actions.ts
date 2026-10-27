"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const classes = ["FIXED_INCOME", "STOCK", "FII", "US_ETF", "CRYPTO"] as const;

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims.sub === "string" ? { supabase, userId: data.claims.sub } : null;
}

export async function createInvestmentInstitution(formData: FormData) {
  const name = z.string().trim().min(1).max(100).safeParse(formData.get("name"));
  const auth = await session();
  if (!name.success || !auth) return;
  await auth.supabase.from("investment_institutions").insert({ user_id: auth.userId, name: name.data });
  revalidatePath("/investments");
}

export async function createInvestmentAsset(formData: FormData) {
  const input = z.object({ name: z.string().trim().min(1).max(160), ticker: z.string().trim().max(30), assetClass: z.enum(classes), institutionId: z.string().uuid().optional() }).safeParse({ name: formData.get("name"), ticker: formData.get("ticker"), assetClass: formData.get("assetClass"), institutionId: formData.get("institutionId") || undefined });
  const auth = await session();
  if (!input.success || !auth) return;
  await auth.supabase.from("investment_assets").insert({ user_id: auth.userId, name: input.data.name, ticker: input.data.ticker || null, asset_class: input.data.assetClass, institution_id: input.data.institutionId ?? null });
  revalidatePath("/investments");
}

export async function createFixedIncomePosition(formData: FormData) {
  const input = z.object({ name: z.string().trim().min(1).max(160), institution: z.string().trim().min(1).max(100), maturityDate: z.iso.date(), quantity: z.coerce.number().positive(), investedAmount: z.coerce.number().min(0), currentAmount: z.coerce.number().min(0), asOfDate: z.iso.date() }).safeParse({ name: formData.get("name"), institution: formData.get("institution"), maturityDate: formData.get("maturityDate"), quantity: formData.get("quantity"), investedAmount: formData.get("investedAmount"), currentAmount: formData.get("currentAmount"), asOfDate: formData.get("asOfDate") });
  const auth = await session();
  if (!input.success || !auth) return;
  const { data: institution } = await auth.supabase.from("investment_institutions").upsert({ user_id: auth.userId, name: input.data.institution }, { onConflict: "user_id,normalized_name" }).select("id").single();
  if (!institution) return;
  const { data: asset } = await auth.supabase.from("investment_assets").insert({ user_id: auth.userId, institution_id: institution.id, asset_class: "FIXED_INCOME", name: input.data.name, ticker: null }).select("id").single();
  if (!asset) return;
  await auth.supabase.from("investment_positions").insert({ user_id: auth.userId, asset_id: asset.id, quantity: input.data.quantity, invested_amount: input.data.investedAmount, current_amount: input.data.currentAmount, maturity_date: input.data.maturityDate, as_of_date: input.data.asOfDate });
  revalidatePath("/investments/portfolio");
}
