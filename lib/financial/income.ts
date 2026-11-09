type NumericValue = number | string;

export type IncomeListItem = {
  id: string;
  description: string;
  amount: NumericValue;
  receivedOn: string;
  cycleMonth: string;
  category: string;
  notes: string | null;
};

export function numericAmountToCents(amount: NumericValue) {
  const normalized = String(amount);
  const [whole, decimal = ""] = normalized.split(".");

  return BigInt(whole) * 100n + BigInt(`${decimal}00`.slice(0, 2));
}

export function calculateIncomeTotal(
  incomes: Pick<IncomeListItem, "amount">[],
) {
  return incomes.reduce(
    (total, income) => total + numericAmountToCents(income.amount),
    0n,
  );
}

export function formatCents(cents: bigint) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(cents) / 100);
}
