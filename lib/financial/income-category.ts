export const incomeCategories = [
  "Salário",
  "Freelance",
  "Reembolso",
  "Rendimentos",
  "Reserva de emergência",
  "Saldo do mês anterior",
  "Outros",
] as const;

export type IncomeCategory = (typeof incomeCategories)[number];

export function isIncomeCategory(value: string): value is IncomeCategory {
  return incomeCategories.includes(value as IncomeCategory);
}
