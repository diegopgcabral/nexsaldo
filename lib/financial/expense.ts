import { amountToCents, type ExpenseStatus } from "@/lib/financial/contracts";

export type ExpenseListItem = {
  id: string;
  description: string;
  referenceAmount: string | number;
  paidAmount: string | number;
  dueDate: string;
  paidAt: string | null;
  category: string;
  status: ExpenseStatus;
  notes: string | null;
};

function toCents(value: string | number) {
  return amountToCents(String(value));
}

export function calculateExpenseTotals(expenses: ExpenseListItem[]) {
  return expenses.reduce(
    (totals, expense) => {
      if (expense.status === "CANCELLED") return totals;

      const plannedCents = toCents(expense.referenceAmount);
      const paidCents = toCents(expense.paidAmount);
      return {
        plannedCents: totals.plannedCents + plannedCents,
        paidCents: totals.paidCents + paidCents,
        openCents:
          totals.openCents +
          (expense.status === "PENDING" ? plannedCents - paidCents : 0n),
      };
    },
    { plannedCents: 0n, paidCents: 0n, openCents: 0n },
  );
}

export type ExpenseCategoryTotal = {
  category: string;
  expenseCount: number;
  paidCents: bigint;
};

export function calculateExpenseCategoryTotals(
  expenses: ExpenseListItem[],
  categories: string[] = [],
): ExpenseCategoryTotal[] {
  const totalsByCategory = new Map<string, ExpenseCategoryTotal>(
    categories.map((category) => [
      category,
      { category, expenseCount: 0, paidCents: 0n },
    ]),
  );

  for (const expense of expenses) {
    if (expense.status !== "PAID") continue;

    const current = totalsByCategory.get(expense.category) ?? {
      category: expense.category,
      expenseCount: 0,
      paidCents: 0n,
    };
    const paidCents = toCents(expense.paidAmount);

    totalsByCategory.set(expense.category, {
      ...current,
      expenseCount: current.expenseCount + 1,
      paidCents: current.paidCents + paidCents,
    });
  }

  return [...totalsByCategory.values()].sort((left, right) =>
    left.category.localeCompare(right.category, "pt-BR"),
  );
}

export function formatExpenseStatus(status: ExpenseStatus) {
  return {
    PENDING: "Pendente",
    PAID: "Paga",
    CANCELLED: "Cancelada",
  }[status];
}
