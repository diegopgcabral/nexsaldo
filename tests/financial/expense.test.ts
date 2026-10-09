import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateExpenseCategoryTotals,
  calculateExpenseTotals,
  type ExpenseListItem,
} from "@/lib/financial/expense";

function expense(
  referenceAmount: string,
  paidAmount: string,
  status: ExpenseListItem["status"],
  category = "Teste",
): ExpenseListItem {
  return {
    category,
    description: "Despesa teste",
    dueDate: "2026-10-01",
    id: crypto.randomUUID(),
    notes: null,
    paidAt: null,
    paidAmount,
    referenceAmount,
    status,
  };
}

test("calculates only pending expenses as open", () => {
  const totals = calculateExpenseTotals([
    expense("1500", "3231.48", "PAID"),
    expense("500", "400", "PAID"),
    expense("210", "0", "PENDING"),
    expense("138", "0", "PENDING"),
    expense("60.99", "0", "PENDING"),
    expense("700", "0", "CANCELLED"),
  ]);

  assert.deepEqual(totals, {
    openCents: 40_899n,
    paidCents: 363_148n,
    plannedCents: 240_899n,
  });
});

test("groups only paid expenses in category totals", () => {
  const totals = calculateExpenseCategoryTotals(
    [
      expense("100", "100", "PAID", "Academia"),
      expense("80", "80", "PAID", "Academia"),
      expense("250", "0", "PENDING", "Moradia"),
      expense("50", "0", "PENDING", "Moradia"),
    ],
    ["Academia", "Moradia", "Saúde"],
  );

  assert.deepEqual(totals, [
    {
      category: "Academia",
      expenseCount: 2,
      paidCents: 18_000n,
    },
    {
      category: "Moradia",
      expenseCount: 0,
      paidCents: 0n,
    },
    {
      category: "Saúde",
      expenseCount: 0,
      paidCents: 0n,
    },
  ]);
});
