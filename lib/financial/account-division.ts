import { invoiceAmountToCents } from "@/lib/financial/credit-card-invoice";

export type StatementPurchase = {
  cardId: string;
  cardName: string;
  cardBankName: string;
  cardLastFour?: string | null;
  description: string;
  amount: string;
  purchasedOn: string;
  installmentNumber: number;
  installmentCount: number;
};

export type StatementManualCharge = {
  id: string;
  description: string;
  amount: string;
  dueOn: string | null;
  notes: string | null;
  installmentNumber: number;
  installmentCount: number;
};
export type StatementPayment = {
  id: string;
  description: string;
  amount: string;
  receivedOn: string;
  notes: string | null;
};

export function centsToCurrency(cents: bigint) {
  return (Number(cents) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function summarizeStatement(
  purchases: StatementPurchase[],
  manualCharges: StatementManualCharge[],
  payments: StatementPayment[],
) {
  const cards = new Map<
    string,
    {
      id: string;
      name: string;
      bankName: string;
      lastFour?: string | null;
      purchases: StatementPurchase[];
      totalCents: bigint;
    }
  >();
  for (const purchase of purchases) {
    const issuerKey = purchase.cardBankName.trim().toLocaleLowerCase("pt-BR");
    const card = cards.get(issuerKey) ?? {
      id: issuerKey,
      name: purchase.cardBankName,
      bankName: purchase.cardBankName,
      lastFour: purchase.cardLastFour,
      purchases: [],
      totalCents: 0n,
    };
    card.purchases.push(purchase);
    card.totalCents += invoiceAmountToCents(purchase.amount);
    cards.set(issuerKey, card);
  }
  const cardsTotalCents = [...cards.values()].reduce(
    (total, card) => total + card.totalCents,
    0n,
  );
  const manualTotalCents = manualCharges.reduce(
    (total, charge) => total + invoiceAmountToCents(charge.amount),
    0n,
  );
  const paymentsTotalCents = payments.reduce(
    (total, payment) => total + invoiceAmountToCents(payment.amount),
    0n,
  );
  const totalDueCents = cardsTotalCents + manualTotalCents - paymentsTotalCents;
  return {
    cards: [...cards.values()],
    cardsTotalCents,
    manualTotalCents,
    paymentsTotalCents,
    totalDueCents: totalDueCents > 0n ? totalDueCents : 0n,
  };
}
