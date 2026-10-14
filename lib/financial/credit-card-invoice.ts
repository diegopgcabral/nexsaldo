import { z } from "zod";

import {
  amountToCents,
  normalizeCurrencyInput,
} from "@/lib/financial/contracts";
import { isMonthReference } from "@/lib/financial/month";

export type PurchaseSplit = {
  id?: string;
  participantId: string | null;
  amount: string;
  paidAt?: string | null;
};
export type PurchaseListItem = {
  id: string;
  cardId: string;
  description: string;
  amount: string;
  purchasedOn: string;
  invoiceMonth: string;
  installmentNumber: number;
  installmentCount: number;
  splits: PurchaseSplit[];
};

export function invoiceAmountToCents(value: string) {
  const normalized = normalizeCurrencyInput(value);
  return /^\d{1,12}(?:\.\d{1,2})?$/.test(normalized)
    ? amountToCents(normalized)
    : 0n;
}

export function summarizeInvoice(purchases: PurchaseListItem[]) {
  const cardTotals = new Map<string, bigint>();
  const personCardTotals = new Map<string, Map<string, bigint>>();
  const personCardPaidTotals = new Map<string, Map<string, bigint>>();
  let total = 0n;
  for (const purchase of purchases) {
    const amount = invoiceAmountToCents(purchase.amount);
    total += amount;
    cardTotals.set(
      purchase.cardId,
      (cardTotals.get(purchase.cardId) ?? 0n) + amount,
    );
    for (const split of purchase.splits) {
      const personId = split.participantId ?? "owner";
      const byCard =
        personCardTotals.get(personId) ?? new Map<string, bigint>();
      byCard.set(
        purchase.cardId,
        (byCard.get(purchase.cardId) ?? 0n) +
          invoiceAmountToCents(split.amount),
      );
      personCardTotals.set(personId, byCard);
      if (split.paidAt) {
        const paidByCard =
          personCardPaidTotals.get(personId) ?? new Map<string, bigint>();
        paidByCard.set(
          purchase.cardId,
          (paidByCard.get(purchase.cardId) ?? 0n) +
            invoiceAmountToCents(split.amount),
        );
        personCardPaidTotals.set(personId, paidByCard);
      }
    }
  }
  return { total, cardTotals, personCardTotals, personCardPaidTotals };
}

export function calculateSplitBalance(amount: string, splits: PurchaseSplit[]) {
  const total = invoiceAmountToCents(amount);
  const allocated = splits.reduce(
    (sum, split) => sum + invoiceAmountToCents(split.amount),
    0n,
  );
  return { total, allocated, difference: total - allocated };
}

const amountSchema = z.string().regex(/^\d{1,12}(?:\.\d{1,2})?$/);
const splitSchema = z.object({
  participantId: z.string().uuid().nullable(),
  amount: z.string(),
});

export function parsePurchaseInput(input: unknown) {
  const shape = z
    .object({
      id: z.string().uuid().nullable(),
      cardId: z.string().uuid(),
      description: z.string().trim().min(1).max(160),
      amount: z.string(),
      purchasedOn: z.iso.date(),
      invoiceMonth: z.string().refine(isMonthReference),
      installmentCount: z.number().int().min(1).max(120),
      splits: z.array(splitSchema).min(1).max(100),
    })
    .safeParse(input);
  if (!shape.success) return { error: "Confira os dados da compra." } as const;
  const purchase = shape.data;
  const amount = normalizeCurrencyInput(purchase.amount);
  if (!amountSchema.safeParse(amount).success || amountToCents(amount) <= 0n)
    return { error: "Informe um valor de compra válido." } as const;

  const seen = new Set<string>();
  const splits = [];
  let sum = 0n;
  for (const split of purchase.splits) {
    const key = split.participantId ?? "owner";
    if (seen.has(key))
      return {
        error: "Cada pessoa deve aparecer uma única vez no rateio.",
      } as const;
    seen.add(key);
    const normalized = normalizeCurrencyInput(split.amount);
    if (
      !amountSchema.safeParse(normalized).success ||
      amountToCents(normalized) <= 0n
    )
      return {
        error: "Informe valores positivos em todas as partes.",
      } as const;
    sum += amountToCents(normalized);
    splits.push({ participantId: split.participantId, amount: normalized });
  }
  if (sum !== amountToCents(amount))
    return {
      error: "A soma das partes deve ser exatamente igual ao valor da compra.",
    } as const;
  return { data: { ...purchase, amount, splits } } as const;
}
