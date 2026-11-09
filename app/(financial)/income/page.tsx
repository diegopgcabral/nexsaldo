import { IncomeManager } from "@/components/financial/income-manager";
import {
  calculateIncomeTotal,
  type IncomeListItem,
} from "@/lib/financial/income";
import {
  getCurrentCycleReference,
  isMonthReference,
} from "@/lib/financial/month";
import { createClient } from "@/lib/supabase/server";

type IncomePageProps = { searchParams: Promise<{ month?: string }> };

export default async function IncomePage({ searchParams }: IncomePageProps) {
  const { month: queryMonth } = await searchParams;
  const requestedMonth = queryMonth ?? null;
  let month = isMonthReference(requestedMonth)
    ? requestedMonth
    : getCurrentCycleReference();
  let cycleStartDay = 1;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  let incomes: IncomeListItem[] = [];

  if (typeof userId === "string") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("financial_cycle_start_day")
      .eq("id", userId)
      .maybeSingle();
    cycleStartDay = profile?.financial_cycle_start_day ?? 1;
    if (!isMonthReference(requestedMonth)) {
      month = getCurrentCycleReference(new Date(), cycleStartDay);
    }
    const { data } = await supabase
      .from("incomes")
      .select("id, description, amount, received_on, cycle_month, category, notes")
      .eq("user_id", userId)
      .eq("cycle_month", `${month}-01`)
      .order("received_on", { ascending: false })
      .order("created_at", { ascending: false });
    incomes = (data ?? []).map((income) => ({
      id: income.id,
      description: income.description,
      amount: income.amount,
      receivedOn: income.received_on,
      cycleMonth: income.cycle_month,
      category: income.category,
      notes: income.notes,
    }));
  }

  return (
    <section>
      <IncomeManager
        cycleStartDay={cycleStartDay}
        incomes={incomes}
        month={month}
        totalCents={calculateIncomeTotal(incomes)}
      />
    </section>
  );
}
