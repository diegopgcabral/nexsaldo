"use server";

import { revalidatePath } from "next/cache";
import { createHash } from "node:crypto";
import { z } from "zod";

import {
  parseB3Negotiations,
  type B3ImportPreview,
} from "@/lib/investments/b3-movements";
import { createClient } from "@/lib/supabase/server";

const classes = ["FIXED_INCOME", "STOCK", "FII", "US_ETF", "CRYPTO"] as const;

export type B3ImportPreviewState =
  | { error: null; preview: null }
  | { error: string; preview: null }
  | { error: null; preview: B3ImportPreview };

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims.sub === "string"
    ? { supabase, userId: data.claims.sub }
    : null;
}

export async function previewB3Negotiations(
  _previousState: B3ImportPreviewState,
  formData: FormData,
): Promise<B3ImportPreviewState> {
  const auth = await session();
  if (!auth)
    return {
      error: "Faça login novamente para importar o relatório.",
      preview: null,
    };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione o arquivo Excel da B3.", preview: null };
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { error: "Envie um arquivo Excel no formato .xlsx.", preview: null };
  }
  if (file.size > 900_000) {
    return {
      error: "O arquivo excede o limite atual de importação.",
      preview: null,
    };
  }

  try {
    return {
      error: null,
      preview: parseB3Negotiations(await file.arrayBuffer()),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível ler o arquivo.",
      preview: null,
    };
  }
}

export async function importB3Negotiations(formData: FormData) {
  const auth = await session();
  if (!auth)
    return { error: "Faça login novamente para importar o relatório." };

  const file = formData.get("file");
  if (
    !(file instanceof File) ||
    file.size === 0 ||
    !file.name.toLowerCase().endsWith(".xlsx")
  ) {
    return {
      error: "Selecione novamente o arquivo Excel de Negociação da B3.",
    };
  }

  let fileContent: ArrayBuffer;
  let preview: B3ImportPreview;
  try {
    fileContent = await file.arrayBuffer();
    preview = parseB3Negotiations(fileContent);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível ler o arquivo.",
    };
  }

  const fileHash = createHash("sha256")
    .update(Buffer.from(fileContent))
    .digest("hex");
  const institutionIds = new Map<string, string>();
  for (const name of [
    ...new Set(preview.items.map((item) => item.institution)),
  ]) {
    const { data, error } = await auth.supabase
      .from("investment_institutions")
      .upsert(
        { user_id: auth.userId, name },
        { onConflict: "user_id,normalized_name" },
      )
      .select("id")
      .single();
    if (error || !data)
      return {
        error: "Não foi possível salvar as instituições da importação.",
      };
    institutionIds.set(name, data.id);
  }

  const assetIds = new Map<string, string>();
  for (const item of preview.positions) {
    const { data, error } = await auth.supabase
      .from("investment_assets")
      .upsert(
        {
          user_id: auth.userId,
          asset_class: item.assetClass,
          name: item.name,
          ticker: item.ticker,
        },
        { onConflict: "user_id,asset_class,ticker" },
      )
      .select("id")
      .single();
    if (error || !data)
      return { error: "Não foi possível salvar os ativos da importação." };
    assetIds.set(`${item.assetClass}:${item.ticker ?? item.name}`, data.id);
  }

  const transactions = preview.items.map((item) => ({
    user_id: auth.userId,
    asset_id: assetIds.get(`${item.assetClass}:${item.ticker ?? item.name}`),
    institution_id: institutionIds.get(item.institution),
    transaction_date: item.date,
    transaction_type: item.transactionType,
    trade_code: item.tradeCode,
    quantity: Math.abs(item.quantity),
    unit_price: item.unitPrice ?? 0,
    total_amount: item.totalAmount ?? 0,
    source_hash: createHash("sha256")
      .update(`${fileHash}:${item.rowNumber}`)
      .digest("hex"),
  }));
  if (
    transactions.some(
      (transaction) => !transaction.asset_id || !transaction.institution_id,
    )
  ) {
    return {
      error:
        "Não foi possível identificar um ativo ou instituição da importação.",
    };
  }

  const { error: transactionError } = await auth.supabase
    .from("investment_transactions")
    .upsert(transactions, {
      ignoreDuplicates: true,
      onConflict: "user_id,source_hash",
    });
  if (transactionError)
    return { error: "Não foi possível salvar as negociações importadas." };

  const { data: savedTransactions, error: savedTransactionsError } =
    await auth.supabase
      .from("investment_transactions")
      .select(
        "asset_id, quantity, total_amount, transaction_date, transaction_type",
      )
      .eq("user_id", auth.userId)
      .order("transaction_date");
  if (savedTransactionsError || !savedTransactions)
    return {
      error:
        "As negociações foram salvas, mas não foi possível atualizar as posições.",
    };

  const balances = new Map<
    string,
    { investedAmount: number; quantity: number }
  >();
  for (const transaction of savedTransactions) {
    const balance = balances.get(transaction.asset_id) ?? {
      investedAmount: 0,
      quantity: 0,
    };
    const quantity = Number(transaction.quantity);
    const amount = Number(transaction.total_amount);
    if (transaction.transaction_type === "BUY") {
      balance.quantity += quantity;
      balance.investedAmount += amount;
    } else if (balance.quantity > 0) {
      balance.investedAmount -=
        (balance.investedAmount / balance.quantity) * quantity;
      balance.quantity -= quantity;
    }
    balances.set(transaction.asset_id, balance);
  }

  const asOfDate = new Date().toISOString().slice(0, 10);
  const positions = [...balances.entries()]
    .filter(([, balance]) => balance.quantity > 0)
    .map(([assetId, balance]) => ({
      user_id: auth.userId,
      asset_id: assetId,
      quantity: balance.quantity,
      invested_amount: Number(balance.investedAmount.toFixed(2)),
      current_amount: Number(balance.investedAmount.toFixed(2)),
      as_of_date: asOfDate,
    }));
  const { error: positionError } = await auth.supabase
    .from("investment_positions")
    .upsert(positions, { onConflict: "user_id,asset_id" });
  if (positionError)
    return {
      error:
        "As negociações foram salvas, mas não foi possível atualizar as posições.",
    };

  revalidatePath("/investments");
  revalidatePath("/investments/portfolio");
  return { imported: preview.items.length };
}

export async function createInvestmentInstitution(formData: FormData) {
  const name = z
    .string()
    .trim()
    .min(1)
    .max(100)
    .safeParse(formData.get("name"));
  const auth = await session();
  if (!name.success || !auth) return;
  await auth.supabase
    .from("investment_institutions")
    .insert({ user_id: auth.userId, name: name.data });
  revalidatePath("/investments");
}

export async function createInvestmentAsset(formData: FormData) {
  const input = z
    .object({
      name: z.string().trim().min(1).max(160),
      ticker: z.string().trim().max(30),
      assetClass: z.enum(classes),
      institutionId: z.string().uuid().optional(),
    })
    .safeParse({
      name: formData.get("name"),
      ticker: formData.get("ticker"),
      assetClass: formData.get("assetClass"),
      institutionId: formData.get("institutionId") || undefined,
    });
  const auth = await session();
  if (!input.success || !auth) return;
  await auth.supabase.from("investment_assets").insert({
    user_id: auth.userId,
    name: input.data.name,
    ticker: input.data.ticker || null,
    asset_class: input.data.assetClass,
    institution_id: input.data.institutionId ?? null,
  });
  revalidatePath("/investments");
}

export async function createFixedIncomePosition(formData: FormData) {
  const input = z
    .object({
      name: z.string().trim().min(1).max(160),
      institution: z.string().trim().min(1).max(100),
      maturityDate: z.iso.date(),
      quantity: z.coerce.number().positive(),
      investedAmount: z.coerce.number().min(0),
      currentAmount: z.coerce.number().min(0),
      asOfDate: z.iso.date(),
    })
    .safeParse({
      name: formData.get("name"),
      institution: formData.get("institution"),
      maturityDate: formData.get("maturityDate"),
      quantity: formData.get("quantity"),
      investedAmount: formData.get("investedAmount"),
      currentAmount: formData.get("currentAmount"),
      asOfDate: formData.get("asOfDate"),
    });
  const auth = await session();
  if (!input.success || !auth) return;
  const { data: institution } = await auth.supabase
    .from("investment_institutions")
    .upsert(
      { user_id: auth.userId, name: input.data.institution },
      { onConflict: "user_id,normalized_name" },
    )
    .select("id")
    .single();
  if (!institution) return;
  const { data: asset } = await auth.supabase
    .from("investment_assets")
    .insert({
      user_id: auth.userId,
      institution_id: institution.id,
      asset_class: "FIXED_INCOME",
      name: input.data.name,
      ticker: null,
    })
    .select("id")
    .single();
  if (!asset) return;
  await auth.supabase.from("investment_positions").insert({
    user_id: auth.userId,
    asset_id: asset.id,
    quantity: input.data.quantity,
    invested_amount: input.data.investedAmount,
    current_amount: input.data.currentAmount,
    maturity_date: input.data.maturityDate,
    as_of_date: input.data.asOfDate,
  });
  revalidatePath("/investments/portfolio");
}
