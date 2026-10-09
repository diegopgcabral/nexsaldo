import Link from "next/link";

import { BalanceEvolutionChart } from "@/components/financial/balance-evolution-chart";
import { ExpenseCategoryIcon } from "@/components/financial/expense-category-icon";
import { Icon } from "@/components/financial/icons";
import {
  calculateExpenseCategoryTotals,
  calculateExpenseTotals,
  type ExpenseListItem,
} from "@/lib/financial/expense";
import {
  calculateIncomeTotal,
  formatCents,
  numericAmountToCents,
  type IncomeListItem,
} from "@/lib/financial/income";
import {
  formatCycleReference,
  getCurrentCycleReference,
  getCycleDateRange,
  isMonthReference,
} from "@/lib/financial/month";
import { createClient } from "@/lib/supabase/server";

type DashboardPageProps = { searchParams: Promise<{ month?: string }> };

const chartColors = ["#00e599", "#4edea3", "#7bd0ff", "#c4a7ff", "#fda4af"];

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  })
    .format(new Date(`${date}T12:00:00`))
    .replace(".", "");
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const { month: queryMonth } = await searchParams;
  const requestedMonth = queryMonth ?? null;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  let cycleStartDay = 1;
  let month = isMonthReference(requestedMonth)
    ? requestedMonth
    : getCurrentCycleReference();
  let incomes: IncomeListItem[] = [];
  let expenses: ExpenseListItem[] = [];
  let categoryIcons: Record<string, string | null> = {};

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

    const { startsOn, endsBefore } = getCycleDateRange(month, cycleStartDay);
    const [
      { data: incomeRows },
      { data: expenseRows },
      { data: categoryRows },
    ] = await Promise.all([
      supabase
        .from("incomes")
        .select("id, description, amount, received_on, category, notes")
        .eq("user_id", userId)
        .gte("received_on", startsOn)
        .lt("received_on", endsBefore)
        .order("received_on"),
      supabase
        .from("expenses")
        .select(
          "id, description, reference_amount, paid_amount, due_date, paid_at, category, status, notes",
        )
        .eq("user_id", userId)
        .gte("due_date", startsOn)
        .lt("due_date", endsBefore)
        .order("due_date"),
      supabase
        .from("expense_categories")
        .select("name, icon_key")
        .eq("user_id", userId),
    ]);

    incomes = (incomeRows ?? []).map((income) => ({
      id: income.id,
      description: income.description,
      amount: income.amount,
      receivedOn: income.received_on,
      category: income.category,
      notes: income.notes,
    }));
    expenses = (expenseRows ?? []).map((expense) => ({
      id: expense.id,
      description: expense.description,
      referenceAmount: expense.reference_amount,
      paidAmount: expense.paid_amount,
      dueDate: expense.due_date,
      paidAt: expense.paid_at,
      category: expense.category,
      status: expense.status,
      notes: expense.notes,
    }));
    categoryIcons = Object.fromEntries(
      (categoryRows ?? []).map((category) => [
        category.name,
        category.icon_key,
      ]),
    );
  }

  const incomeCents = calculateIncomeTotal(incomes);
  const expenseTotals = calculateExpenseTotals(expenses);
  const balanceCents = incomeCents - expenseTotals.paidCents;
  const categoryTotals = calculateExpenseCategoryTotals(expenses)
    .filter((item) => item.paidCents > 0n)
    .sort((left, right) => (left.paidCents > right.paidCents ? -1 : 1))
    .slice(0, 5);
  const dueExpenses = expenses
    .filter((expense) => expense.status === "PENDING")
    .slice(0, 5);
  const paidExpenseCount = expenses.filter(
    (expense) => expense.status === "PAID",
  ).length;
  const pendingExpenseCount = expenses.filter(
    (expense) => expense.status === "PENDING",
  ).length;

  const eventDates = [
    ...new Set([
      ...incomes.map((item) => item.receivedOn),
      ...expenses
        .map((item) => item.paidAt)
        .filter((date): date is string => Boolean(date)),
    ]),
  ].sort();
  const chartPoints = eventDates.reduce<Array<{ date: string; value: bigint }>>(
    (points, date) => {
      const previousBalance = points.at(-1)?.value ?? 0n;
      const incomeForDate = calculateIncomeTotal(
        incomes.filter((income) => income.receivedOn === date),
      );
      const paidForDate = calculateExpenseTotals(
        expenses.filter((expense) => expense.paidAt === date),
      ).paidCents;

      return [
        ...points,
        { date, value: previousBalance + incomeForDate - paidForDate },
      ];
    },
    [],
  );
  const hasData = incomes.length > 0 || expenses.length > 0;

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-emerald-300 uppercase">
            <span className="rounded-full bg-[#272a30] px-2 py-1">
              Dashboard financeiro
            </span>
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Ciclo atual
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Visão geral
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {formatCycleReference(month, cycleStartDay)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex items-center gap-2 rounded-xl bg-[#272a30] px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-[#36393f]"
            href={`/income?month=${month}`}
          >
            <Icon className="size-4" name="income" /> Receita
          </Link>
          <Link
            className="inline-flex items-center gap-2 rounded-xl bg-[#00e599] px-4 py-2.5 text-sm font-semibold text-[#003822] shadow-[0_0_20px_rgba(0,229,153,0.2)] transition hover:brightness-110"
            href={`/expenses?month=${month}`}
          >
            <Icon className="size-4" name="plus" /> Nova despesa
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon="income"
          label="Receita do ciclo"
          note={`${incomes.length} lançamento${incomes.length === 1 ? "" : "s"} recebido${incomes.length === 1 ? "" : "s"}`}
          tone="text-emerald-300"
          value={formatCents(incomeCents)}
        />
        <MetricCard
          icon="expense"
          label="Despesas pagas"
          note={`${paidExpenseCount} lançamento${paidExpenseCount === 1 ? "" : "s"} quitado${paidExpenseCount === 1 ? "" : "s"}`}
          tone="text-sky-200"
          value={formatCents(expenseTotals.paidCents)}
        />
        <MetricCard
          icon="receipt"
          label="Em aberto"
          note={`${pendingExpenseCount} despesa${pendingExpenseCount === 1 ? "" : "s"} pendente${pendingExpenseCount === 1 ? "" : "s"}`}
          tone="text-sky-200"
          value={formatCents(expenseTotals.openCents)}
        />
        <MetricCard
          featured
          icon="wallet"
          label="Saldo disponível"
          note={
            balanceCents >= 0n
              ? "Receitas menos despesas pagas"
              : "Atenção ao fluxo de caixa"
          }
          tone="text-emerald-300"
          value={formatCents(balanceCents)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <section className="rounded-2xl bg-[#191c21] p-5 shadow-xl shadow-black/15 sm:p-6 xl:col-span-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Evolução do saldo
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Entradas menos despesas pagas ao longo do ciclo.
              </p>
            </div>
            <Icon className="size-5 text-emerald-300" name="income" />
          </div>
          {chartPoints.length ? (
            <BalanceEvolutionChart
              points={chartPoints.map((point) => ({
                date: point.date,
                valueCents: point.value.toString(),
              }))}
            />
          ) : (
            <EmptyChart />
          )}
        </section>

        <section className="rounded-2xl bg-[#191c21] p-5 shadow-xl shadow-black/15 sm:p-6 xl:col-span-4">
          <h2 className="text-lg font-semibold text-white">
            Despesas por categoria
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Distribuição dos pagamentos neste ciclo.
          </p>
          {categoryTotals.length ? (
            <div className="mt-5 space-y-3">
              {categoryTotals.map((item, index) => {
                const percentage = Number(
                  (item.paidCents * 100n) / expenseTotals.paidCents,
                );
                return (
                  <div key={item.category}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2 text-slate-200">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: chartColors[index] }}
                        />
                        {item.category}
                      </span>
                      <span className="shrink-0 font-medium text-white">
                        {formatCents(item.paidCents)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#272a30]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          backgroundColor: chartColors[index],
                          width: `${percentage}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyChart label="Os pagamentos por categoria aparecerão aqui." />
          )}
        </section>
      </div>

      <section className="rounded-2xl bg-[#191c21] p-5 shadow-xl shadow-black/15 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Próximos vencimentos
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {dueExpenses.length
                ? `${dueExpenses.length} despesa${dueExpenses.length === 1 ? "" : "s"} pendente${dueExpenses.length === 1 ? "" : "s"} neste ciclo.`
                : "Nenhuma despesa pendente neste ciclo."}
            </p>
          </div>
          <Link
            className="text-sm font-semibold text-emerald-300 transition hover:text-emerald-200"
            href={`/expenses?month=${month}`}
          >
            Ver despesas →
          </Link>
        </div>
        {dueExpenses.length ? (
          <div className="mt-5 divide-y divide-white/5">
            {dueExpenses.map((expense) => (
              <div
                className="flex items-center justify-between gap-4 py-3"
                key={expense.id}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <ExpenseCategoryIcon
                    compact
                    iconKey={categoryIcons[expense.category]}
                    name={expense.category}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {expense.description}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {expense.category} · vence em{" "}
                      {formatDate(expense.dueDate)}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold text-white">
                    {formatCents(numericAmountToCents(expense.referenceAmount))}
                  </p>
                  <span className="text-xs text-amber-300">Pendente</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-xl bg-[#111319] p-5 text-sm text-slate-400">
            Cadastre despesas para acompanhar os próximos vencimentos.
          </p>
        )}
      </section>
      {!hasData ? (
        <p className="text-center text-sm text-slate-500">
          Comece cadastrando receitas e despesas para preencher sua visão
          financeira.
        </p>
      ) : null}
    </section>
  );
}

function MetricCard({
  icon,
  label,
  note,
  tone,
  value,
  featured = false,
}: {
  icon: "income" | "expense" | "receipt" | "wallet";
  label: string;
  note: string;
  tone: string;
  value: string;
  featured?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 shadow-xl shadow-black/15 ${featured ? "bg-gradient-to-br from-[#1d2825] to-[#191c21] ring-1 ring-emerald-400/15" : "bg-[#191c21]"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-slate-400 uppercase">
            {label}
          </p>
          <p className={`mt-3 text-3xl font-semibold tracking-tight ${tone}`}>
            {value}
          </p>
        </div>
        <span
          className={`flex size-11 items-center justify-center rounded-xl bg-white/5 ${tone}`}
        >
          <Icon className="size-5" name={icon} />
        </span>
      </div>
      <p className="mt-4 text-sm text-slate-400">{note}</p>
    </div>
  );
}

function EmptyChart({
  label = "A evolução será exibida quando houver lançamentos no ciclo.",
}: {
  label?: string;
}) {
  return (
    <div className="mt-6 flex h-52 items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#111319]/50 px-6 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}
