import { z } from "zod";

import { incomeCategories } from "@/lib/financial/income-category";

export const expenseStatuses = ["PENDING", "PAID", "CANCELLED"] as const;

export const expenseStatusSchema = z.enum(expenseStatuses);

const decimalAmountSchema = z
  .string()
  .regex(
    /^\d{1,12}(?:\.\d{1,2})?$/,
    "Use um valor positivo com até duas casas decimais.",
  );

const positiveAmountSchema = decimalAmountSchema.refine(
  (value) => amountToCents(value) > 0n,
  "O valor deve ser maior que zero.",
);

const dateSchema = z.iso.date();
const descriptionSchema = z.string().trim().min(1).max(200);
const categorySchema = z.string().trim().min(1).max(100);
const incomeCategorySchema = z.enum(incomeCategories, {
  error: "Selecione uma categoria de receita válida.",
});
const notesSchema = z.string().trim().max(2_000).optional();

export const createIncomeSchema = z.object({
  description: descriptionSchema,
  amount: positiveAmountSchema,
  receivedOn: dateSchema,
  category: incomeCategorySchema,
  notes: notesSchema,
});

export const createExpenseSchema = z
  .object({
    description: descriptionSchema,
    referenceAmount: positiveAmountSchema,
    paidAmount: decimalAmountSchema.default("0"),
    dueDate: dateSchema,
    category: categorySchema,
    status: expenseStatusSchema.default("PENDING"),
    notes: notesSchema,
  })
  .superRefine((expense, context) => {
    const paidAmount = amountToCents(expense.paidAmount);

    if (expense.status === "CANCELLED" && paidAmount !== 0n) {
      context.addIssue({
        code: "custom",
        message: "Uma despesa cancelada não pode ter pagamento registrado.",
        path: ["status"],
      });
    }
  });

export type CreateIncomeInput = z.infer<typeof createIncomeSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type ExpenseStatus = z.infer<typeof expenseStatusSchema>;

export function amountToCents(amount: string) {
  const [whole, decimal = ""] = amount.split(".");
  return BigInt(whole) * 100n + BigInt(`${decimal}00`.slice(0, 2));
}

export function normalizeCurrencyInput(value: string) {
  const normalized = value.trim().replace(/\s/g, "");

  if (/^\d{1,12}(?:\.\d{1,2})?$/.test(normalized)) {
    return normalized;
  }

  if (/^\d{1,12}(?:\.\d{3})*(?:,\d{1,2})?$/.test(normalized)) {
    return normalized.replaceAll(".", "").replace(",", ".");
  }

  return normalized;
}
