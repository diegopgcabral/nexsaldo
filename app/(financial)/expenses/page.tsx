import { ExpenseManager } from "@/components/financial/expense-manager";
import {
  calculateExpenseTotals,
  type ExpenseListItem,
} from "@/lib/financial/expense";
import {
  getCurrentCycleReference,
  getCycleDateRange,
  isMonthReference,
} from "@/lib/financial/month";
import { createClient } from "@/lib/supabase/server";

type ExpensesPageProps = { searchParams: Promise<{ month?: string }> };

export default async function ExpensesPage({
  searchParams,
}: ExpensesPageProps) {
  const { month: queryMonth } = await searchParams;
  const requestedMonth = queryMonth ?? null;
  let month = isMonthReference(requestedMonth)
    ? requestedMonth
    : getCurrentCycleReference();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  let expenses: ExpenseListItem[] = [];
  let categories: string[] = [];
  let categoryIcons: Record<string, string | null> = {};

  if (typeof userId === "string") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("financial_cycle_start_day")
      .eq("id", userId)
      .maybeSingle();
    const cycleStartDay = profile?.financial_cycle_start_day ?? 1;
    if (!isMonthReference(requestedMonth)) {
      month = getCurrentCycleReference(new Date(), cycleStartDay);
    }
    const { startsOn, endsBefore } = getCycleDateRange(month, cycleStartDay);
    const { data } = await supabase
      .from("expenses")
      .select(
        "id, description, reference_amount, paid_amount, due_date, paid_at, category, status, notes, is_recurring",
      )
      .eq("user_id", userId)
      .gte("due_date", startsOn)
      .lt("due_date", endsBefore)
      .order("due_date");
    expenses = (data ?? []).map((expense) => ({
      id: expense.id,
      description: expense.description,
      referenceAmount: expense.reference_amount,
      paidAmount: expense.paid_amount,
      dueDate: expense.due_date,
      paidAt: expense.paid_at,
      category: expense.category,
      status: expense.status,
      notes: expense.notes,
      isRecurring: expense.is_recurring,
    }));
    const { data: categoryRows } = await supabase
      .from("expense_categories")
      .select("name, icon_key, is_active")
      .eq("user_id", userId)
      .order("name");
    categories = (categoryRows ?? [])
      .filter((category) => category.is_active)
      .map((category) => category.name);
    categoryIcons = Object.fromEntries(
      (categoryRows ?? []).map((category) => [
        category.name,
        category.icon_key,
      ]),
    );
  }
  const totals = calculateExpenseTotals(expenses);

  return (
    <section>
      <ExpenseManager
        categories={categories}
        categoryIcons={categoryIcons}
        expenses={expenses}
        month={month}
        totals={totals}
      />
    </section>
  );
}
