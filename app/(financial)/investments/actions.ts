"use server";

import { revalidatePath } from "next/cache";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

import {
  parseB3Negotiations,
  type B3ImportPreview,
} from "@/lib/investments/b3-movements";
import { normalizeCurrencyInput } from "@/lib/financial/contracts";
import { createClient } from "@/lib/supabase/server";

const classes = [
  "FIXED_INCOME",
  "STOCK",
  "FII",
  "US_ETF",
  "BRAZILIAN_ETF",
  "BDR",
  "FUND",
  "PENSION",
  "CASH_BOX",
  "CRYPTO",
] as const;

const fixedIncomeSubtypes = [
  "DIRECT_TREASURY",
  "CDB",
  "LCI",
  "LCA",
  "DEBENTURE",
  "CRI_CRA",
  "CASH_BOX",
  "OTHER",
] as const;

export type B3ImportPreviewState =
  | { error: null; preview: null }
  | { error: string; preview: null }
  | { error: null; preview: B3ImportPreview };

export type ManualInvestmentTransactionState = {
  error?: string;
  success?: string;
};

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims.sub === "string"
    ? { supabase, userId: data.claims.sub }
    : null;
}

async function refreshInvestmentPosition(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  assetId: string,
) {
  const { data: transactions, error } = await supabase
    .from("investment_transactions")
    .select("quantity, total_amount, transaction_type")
    .eq("user_id", userId)
    .eq("asset_id", assetId)
    .order("transaction_date");
  if (error || !transactions) return false;

  const balance = { investedAmount: 0, quantity: 0 };
  for (const transaction of transactions) {
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
  }

  if (balance.quantity <= 0) {
    const { error: deleteError } = await supabase
      .from("investment_positions")
      .delete()
      .eq("user_id", userId)
      .eq("asset_id", assetId);
    return !deleteError;
  }

  const amount = Number(balance.investedAmount.toFixed(2));
  const { error: positionError } = await supabase
    .from("investment_positions")
    .upsert(
      {
        user_id: userId,
        asset_id: assetId,
        quantity: balance.quantity,
        invested_amount: amount,
        current_amount: amount,
        as_of_date: new Date().toISOString().slice(0, 10),
      },
      { onConflict: "user_id,asset_id" },
    );
  return !positionError;
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
    const assetKey = `${item.assetClass}:${item.ticker ?? item.name}`;
    const firstNegotiation = preview.items.find(
      (negotiation) =>
        `${negotiation.assetClass}:${negotiation.ticker ?? negotiation.name}` ===
        assetKey,
    );
    const { data, error } = await auth.supabase
      .from("investment_assets")
      .upsert(
        {
          user_id: auth.userId,
          asset_class: item.assetClass,
          institution_id: firstNegotiation
            ? institutionIds.get(firstNegotiation.institution)
            : null,
          name: item.name,
          ticker: item.ticker,
        },
        { onConflict: "user_id,asset_class,ticker" },
      )
      .select("id")
      .single();
    if (error || !data)
      return { error: "Não foi possível salvar os ativos da importação." };
    assetIds.set(assetKey, data.id);
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
  if (!name.success || !auth)
    return { error: "Informe um nome válido para a instituição." };
  const { error } = await auth.supabase
    .from("investment_institutions")
    .insert({ user_id: auth.userId, name: name.data });
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Esta instituição já está cadastrada."
          : "Não foi possível cadastrar a instituição.",
    };
  }
  revalidateInvestmentInstitutionPaths();
  return { success: "Instituição adicionada." };
}

export async function updateInvestmentInstitution(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("id"));
  const name = z.string().trim().min(1).max(100).safeParse(formData.get("name"));
  const auth = await session();
  if (!id.success || !name.success || !auth)
    return { error: "Não foi possível validar a instituição." };
  const { error } = await auth.supabase
    .from("investment_institutions")
    .update({ name: name.data })
    .eq("id", id.data)
    .eq("user_id", auth.userId);
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Já existe uma instituição com este nome."
          : "Não foi possível editar a instituição.",
    };
  }
  revalidateInvestmentInstitutionPaths();
  return { success: "Instituição atualizada." };
}

export async function deleteInvestmentInstitution(id: string) {
  const parsedId = z.string().uuid().safeParse(id);
  const auth = await session();
  if (!parsedId.success || !auth)
    return { error: "Não foi possível validar a instituição." };
  const { error } = await auth.supabase
    .from("investment_institutions")
    .delete()
    .eq("id", parsedId.data)
    .eq("user_id", auth.userId);
  if (error) return { error: "Não foi possível excluir a instituição." };
  revalidateInvestmentInstitutionPaths();
  return { success: "Instituição excluída." };
}

function revalidateInvestmentInstitutionPaths() {
  revalidatePath("/investments");
  revalidatePath("/investments/institutions");
  revalidatePath("/investments/products");
  revalidatePath("/investments/portfolio");
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
  const ticker =
    input.data.ticker ||
    `manual-${createHash("sha256")
      .update(`${auth.userId}:${input.data.assetClass}:${input.data.name}`)
      .digest("hex")
      .slice(0, 20)}`;
  await auth.supabase.from("investment_assets").upsert({
    user_id: auth.userId,
    name: input.data.name,
    ticker,
    asset_class: input.data.assetClass,
    fixed_income_subtype:
      input.data.assetClass === "FIXED_INCOME" ? "OTHER" : null,
    institution_id: input.data.institutionId ?? null,
  }, { onConflict: "user_id,asset_class,ticker" });
  revalidatePath("/investments");
  revalidatePath("/investments/products");
  revalidatePath("/investments/portfolio");
}

export async function createManualInvestmentTransaction(
  _previousState: ManualInvestmentTransactionState,
  formData: FormData,
): Promise<ManualInvestmentTransactionState> {
  const input = z
    .object({
      assetClass: z.enum(classes),
      fixedIncomeSubtype: z.enum(fixedIncomeSubtypes).optional(),
      institutionId: z.string().uuid(),
      name: z.string().trim().max(160),
      quantity: z.coerce.number().positive(),
      ticker: z.string().trim().min(1).max(30),
      totalAmount: z.coerce.number().positive(),
      transactionDate: z.iso.date(),
      transactionType: z.enum(["BUY", "SELL"]),
      unitPrice: z.coerce.number().positive(),
    })
    .superRefine((value, context) => {
      if (value.assetClass === "FIXED_INCOME" && !value.fixedIncomeSubtype) {
        context.addIssue({
          code: "custom",
          message: "Selecione o tipo de renda fixa.",
          path: ["fixedIncomeSubtype"],
        });
      }
    })
    .safeParse({
      assetClass: formData.get("assetClass"),
      fixedIncomeSubtype: formData.get("fixedIncomeSubtype") || undefined,
      institutionId: formData.get("institutionId"),
      name: formData.get("name"),
      quantity: normalizeCurrencyInput(String(formData.get("quantity") ?? "")),
      ticker: formData.get("ticker"),
      totalAmount: normalizeCurrencyInput(
        String(formData.get("totalAmount") ?? ""),
      ),
      transactionDate: formData.get("transactionDate"),
      transactionType: formData.get("transactionType"),
      unitPrice: normalizeCurrencyInput(
        String(formData.get("unitPrice") ?? ""),
      ),
    });
  const auth = await session();
  if (!input.success)
    return {
      error:
        input.error.issues[0]?.message ??
        "Revise os campos obrigatórios da negociação.",
    };
  if (!auth) return { error: "Faça login novamente para continuar." };

  const { data: institution, error: institutionError } = await auth.supabase
    .from("investment_institutions")
    .select("id")
    .eq("id", input.data.institutionId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (institutionError || !institution)
    return { error: "Selecione uma instituição cadastrada." };

  const ticker = input.data.ticker.toUpperCase();
  const { data: existingAsset, error: existingAssetError } = await auth.supabase
    .from("investment_assets")
    .select("id")
    .eq("user_id", auth.userId)
    .eq("asset_class", input.data.assetClass)
    .eq("ticker", ticker)
    .maybeSingle();
  if (existingAssetError)
    return { error: "Não foi possível localizar o ativo da negociação." };

  const { data: asset, error: assetError } = existingAsset
    ? { data: existingAsset, error: null }
    : await auth.supabase
        .from("investment_assets")
        .insert({
          user_id: auth.userId,
          institution_id: input.data.institutionId,
          asset_class: input.data.assetClass,
          fixed_income_subtype:
            input.data.assetClass === "FIXED_INCOME"
              ? input.data.fixedIncomeSubtype
              : null,
          name: input.data.name || ticker,
          ticker,
        })
        .select("id")
        .single();
  if (assetError || !asset)
    return { error: "Não foi possível salvar o ativo da negociação." };

  const { data: existingTransactions, error: historyError } = await auth.supabase
    .from("investment_transactions")
    .select("quantity, transaction_type")
    .eq("user_id", auth.userId)
    .eq("asset_id", asset.id);
  if (historyError || !existingTransactions)
    return { error: "Não foi possível conferir a posição atual do ativo." };

  const heldQuantity = existingTransactions.reduce(
    (total, transaction) =>
      total +
      (transaction.transaction_type === "BUY"
        ? Number(transaction.quantity)
        : -Number(transaction.quantity)),
    0,
  );
  if (
    input.data.transactionType === "SELL" &&
    input.data.quantity > heldQuantity
  ) {
    return { error: "A quantidade vendida não pode ser maior que a posição atual." };
  }

  const { error: transactionError } = await auth.supabase
    .from("investment_transactions")
    .insert({
      user_id: auth.userId,
      asset_id: asset.id,
      institution_id: input.data.institutionId,
      transaction_date: input.data.transactionDate,
      transaction_type: input.data.transactionType,
      trade_code: ticker,
      quantity: input.data.quantity,
      unit_price: input.data.unitPrice,
      total_amount: input.data.totalAmount,
      source_hash: createHash("sha256")
        .update(`${auth.userId}:${randomUUID()}`)
        .digest("hex"),
    });
  if (transactionError)
    return { error: "Não foi possível salvar a negociação." };

  if (!(await refreshInvestmentPosition(auth.supabase, auth.userId, asset.id))) {
    return {
      error:
        "A negociação foi salva, mas não foi possível atualizar a posição.",
    };
  }

  revalidatePath("/investments");
  revalidatePath("/investments/portfolio");
  return { success: "Negociação adicionada à carteira." };
}

export async function createManualInvestment(formData: FormData) {
  const input = z
    .object({
      name: z.string().trim().min(1).max(160),
      ticker: z.string().trim().max(30),
      assetClass: z.enum(classes),
      institutionId: z.string().uuid(),
      quantity: z.coerce.number().positive(),
      investedAmount: z.coerce.number().min(0),
      currentAmount: z.coerce.number().min(0),
      maturityDate: z.union([z.iso.date(), z.literal("")]),
    })
    .safeParse({
      name: formData.get("name"),
      ticker: formData.get("ticker"),
      assetClass: formData.get("assetClass"),
      institutionId: formData.get("institutionId"),
      quantity: formData.get("quantity"),
      investedAmount: formData.get("investedAmount"),
      currentAmount: formData.get("currentAmount"),
      maturityDate: formData.get("maturityDate"),
    });
  const auth = await session();
  if (!input.success || !auth)
    return { error: "Revise os campos obrigatórios do produto." };

  const ticker =
    input.data.ticker ||
    `manual-${createHash("sha256")
      .update(`${auth.userId}:${input.data.assetClass}:${input.data.name}`)
      .digest("hex")
      .slice(0, 20)}`;
  const { data: asset } = await auth.supabase
    .from("investment_assets")
    .upsert(
      {
        user_id: auth.userId,
        institution_id: input.data.institutionId,
        asset_class: input.data.assetClass,
        fixed_income_subtype:
          input.data.assetClass === "FIXED_INCOME" ? "OTHER" : null,
        name: input.data.name,
        ticker,
      },
      { onConflict: "user_id,asset_class,ticker" },
    )
    .select("id")
    .single();
  if (!asset) return { error: "Não foi possível salvar o produto." };

  const { error: positionError } = await auth.supabase
    .from("investment_positions")
    .upsert(
    {
      user_id: auth.userId,
      asset_id: asset.id,
      quantity: input.data.quantity,
      invested_amount: input.data.investedAmount,
      current_amount: input.data.currentAmount,
      maturity_date: input.data.maturityDate || null,
      as_of_date: new Date().toISOString().slice(0, 10),
    },
    { onConflict: "user_id,asset_id" },
    );
  if (positionError) return { error: "Não foi possível salvar a posição." };
  revalidatePath("/investments");
  revalidatePath("/investments/products");
  revalidatePath("/investments/portfolio");
  return { success: "Produto adicionado à carteira." };
}

export async function updateManualInvestment(formData: FormData) {
  const input = z
    .object({
      id: z.string().uuid(),
      name: z.string().trim().min(1).max(160),
      ticker: z.string().trim().max(30),
      assetClass: z.enum(classes),
      institutionId: z.string().uuid(),
      quantity: z.coerce.number().positive(),
      investedAmount: z.coerce.number().min(0),
      currentAmount: z.coerce.number().min(0),
      maturityDate: z.union([z.iso.date(), z.literal("")]),
    })
    .safeParse({
      id: formData.get("id"),
      name: formData.get("name"),
      ticker: formData.get("ticker"),
      assetClass: formData.get("assetClass"),
      institutionId: formData.get("institutionId"),
      quantity: formData.get("quantity"),
      investedAmount: formData.get("investedAmount"),
      currentAmount: formData.get("currentAmount"),
      maturityDate: formData.get("maturityDate"),
    });
  const auth = await session();
  if (!input.success || !auth)
    return { error: "Revise os campos obrigatórios do produto." };
  const ticker =
    input.data.ticker ||
    `manual-${createHash("sha256")
      .update(`${auth.userId}:${input.data.assetClass}:${input.data.name}`)
      .digest("hex")
      .slice(0, 20)}`;
  const { error: assetError } = await auth.supabase
    .from("investment_assets")
    .update({
      asset_class: input.data.assetClass,
      fixed_income_subtype:
        input.data.assetClass === "FIXED_INCOME" ? "OTHER" : null,
      institution_id: input.data.institutionId,
      name: input.data.name,
      ticker,
    })
    .eq("id", input.data.id)
    .eq("user_id", auth.userId);
  if (assetError) return { error: "Não foi possível editar o produto." };
  const { error: positionError } = await auth.supabase
    .from("investment_positions")
    .upsert(
      {
        user_id: auth.userId,
        asset_id: input.data.id,
        quantity: input.data.quantity,
        invested_amount: input.data.investedAmount,
        current_amount: input.data.currentAmount,
        maturity_date: input.data.maturityDate || null,
        as_of_date: new Date().toISOString().slice(0, 10),
      },
      { onConflict: "user_id,asset_id" },
    );
  if (positionError) return { error: "Não foi possível atualizar a posição." };
  revalidateInvestmentProductPaths();
  return { success: "Produto atualizado." };
}

export async function deleteManualInvestment(id: string) {
  const parsedId = z.string().uuid().safeParse(id);
  const auth = await session();
  if (!parsedId.success || !auth) return { error: "Produto inválido." };
  const { error } = await auth.supabase
    .from("investment_assets")
    .delete()
    .eq("id", parsedId.data)
    .eq("user_id", auth.userId);
  if (error) return { error: "Não foi possível excluir o produto." };
  revalidateInvestmentProductPaths();
  return { success: "Produto excluído." };
}

function revalidateInvestmentProductPaths() {
  revalidatePath("/investments");
  revalidatePath("/investments/products");
  revalidatePath("/investments/portfolio");
}

export async function addInvestmentProductType(assetClass: string) {
  const parsedClass = z.enum(classes).safeParse(assetClass);
  const auth = await session();
  if (!parsedClass.success || !auth) return { error: "Tipo de produto inválido." };
  const { error } = await auth.supabase
    .from("investment_product_types")
    .upsert(
      {
        user_id: auth.userId,
        asset_class: parsedClass.data,
        is_active: true,
      },
      { onConflict: "user_id,asset_class" },
    );
  if (error) return { error: "Não foi possível adicionar o tipo de produto." };
  revalidateInvestmentProductPaths();
  return { success: "Tipo de produto adicionado." };
}

export async function removeInvestmentProductType(assetClass: string) {
  const parsedClass = z.enum(classes).safeParse(assetClass);
  const auth = await session();
  if (!parsedClass.success || !auth) return { error: "Tipo de produto inválido." };
  const { error } = await auth.supabase
    .from("investment_product_types")
    .upsert(
      {
        user_id: auth.userId,
        asset_class: parsedClass.data,
        is_active: false,
      },
      { onConflict: "user_id,asset_class" },
    );
  if (error) return { error: "Não foi possível remover o tipo de produto." };
  revalidateInvestmentProductPaths();
  return { success: "Tipo removido da lista." };
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
      fixed_income_subtype: "OTHER",
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
