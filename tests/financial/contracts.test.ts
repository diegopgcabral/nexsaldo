import assert from "node:assert/strict";
import test from "node:test";

import {
  createExpenseSchema,
  createIncomeSchema,
  normalizeCurrencyInput,
} from "@/lib/financial/contracts";
import { calculateMonthlySummary } from "@/lib/financial/monthly-summary";

test("accepts a valid income with a precise decimal amount", () => {
  const result = createIncomeSchema.safeParse({
    description: "Salário",
    amount: "20000.50",
    receivedOn: "2026-10-05",
    category: "Salário",
  });

  assert.equal(result.success, true);
});

test("rejects an income with a zero amount", () => {
  const result = createIncomeSchema.safeParse({
    description: "Salário",
    amount: "0",
    receivedOn: "2026-10-05",
    category: "Salário",
  });

  assert.equal(result.success, false);
});

test("rejects an expense category when registering income", () => {
  const result = createIncomeSchema.safeParse({
    description: "Pagamento recebido",
    amount: "200.00",
    receivedOn: "2026-10-05",
    category: "Moradia",
  });

  assert.equal(result.success, false);
});

test("accepts the previous month balance as an income category", () => {
  const result = createIncomeSchema.safeParse({
    description: "Saldo trazido do mês anterior",
    amount: "150.00",
    receivedOn: "2026-10-01",
    category: "Saldo do mês anterior",
  });

  assert.equal(result.success, true);
});

test("normalizes Brazilian currency input before validating it", () => {
  assert.equal(normalizeCurrencyInput("50.000,25"), "50000.25");
  assert.equal(normalizeCurrencyInput("50000.25"), "50000.25");
});

test("accepts an expense payment larger than its reference amount", () => {
  const result = createExpenseSchema.safeParse({
    description: "Condomínio",
    referenceAmount: "850.00",
    paidAmount: "900.00",
    dueDate: "2026-10-10",
    category: "Moradia",
    status: "PAID",
  });

  assert.equal(result.success, true);
});

test("accepts a paid expense even when its value differs from the planned amount", () => {
  const result = createExpenseSchema.safeParse({
    description: "Supermercado",
    referenceAmount: "1000.00",
    paidAmount: "600.00",
    dueDate: "2026-10-10",
    category: "Alimentação",
    status: "PAID",
  });

  assert.equal(result.success, true);
});

test("requires only the paid amount for a one-time expense", () => {
  const result = createExpenseSchema.safeParse({
    description: "Café",
    referenceAmount: "0",
    paidAmount: "15.00",
    dueDate: "2026-10-10",
    category: "Alimentação",
    status: "PAID",
    isRecurring: false,
  });

  assert.equal(result.success, true);
});

test("requires a forecast amount for recurring expenses", () => {
  const result = createExpenseSchema.safeParse({
    description: "Internet",
    referenceAmount: "0",
    paidAmount: "0",
    dueDate: "2026-10-10",
    category: "Moradia",
    status: "PENDING",
    isRecurring: true,
  });

  assert.equal(result.success, false);
});

test("calculates monthly balances in cents", () => {
  const summary = calculateMonthlySummary({
    incomeCents: 2_000_000n,
    plannedExpenseCents: 600_000n,
    paidExpenseCents: 450_000n,
  });

  assert.deepEqual(summary, {
    incomeCents: 2_000_000n,
    plannedExpenseCents: 600_000n,
    paidExpenseCents: 450_000n,
    balanceCents: 1_550_000n,
    pendingExpenseCents: 150_000n,
  });
});
