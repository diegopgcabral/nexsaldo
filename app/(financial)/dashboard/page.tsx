import Link from "next/link";

import { ExpenseCategoryIcon } from "@/components/financial/expense-category-icon";
import { ExpenseCategoryDonut } from "@/components/financial/expense-category-donut";
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
import {
  defaultNavigationModules,
  normalizeNavigationModules,
} from "@/lib/financial/navigation-modules";
import { createClient } from "@/lib/supabase/server";

type DashboardPageProps = { searchParams: Promise<{ month?: string }> };

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
  let navigationModules = defaultNavigationModules;

  if (typeof userId === "string") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("financial_cycle_start_day, navigation_modules")
      .eq("id", userId)
      .maybeSingle();
    cycleStartDay = profile?.financial_cycle_start_day ?? 1;
    navigationModules = normalizeNavigationModules(profile?.navigation_modules);
    if (!isMonthReference(requestedMonth)) {
      month = getCurrentCycleReference(new Date(), cycleStartDay);
    }

    if (navigationModules.transactions) {
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
            "id, description, reference_amount, paid_amount, due_date, paid_at, category, status, notes, is_recurring",
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
        isRecurring: expense.is_recurring,
      }));
      categoryIcons = Object.fromEntries(
        (categoryRows ?? []).map((category) => [
          category.name,
          category.icon_key,
        ]),
      );
    }
  }

  return renderDashboard();

  function renderDashboard() {
    const incomeCents = calculateIncomeTotal(incomes);
    const expenseTotals = calculateExpenseTotals(expenses);
    const balanceCents = incomeCents - expenseTotals.paidCents;
    const categoryTotals = calculateExpenseCategoryTotals(expenses)
      .filter((item) => item.paidCents > 0n)
      .sort((left, right) =>
        left.paidCents === right.paidCents
          ? left.category.localeCompare(right.category, "pt-BR")
          : left.paidCents > right.paidCents
            ? -1
            : 1,
      );
    const dueExpenses = expenses
      .filter((expense) => expense.status === "PENDING")
      .slice(0, 5);
    const projectedBalanceCents = balanceCents - expenseTotals.openCents;
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
          {navigationModules.transactions ? (
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
          ) : null}
        </div>

        {navigationModules.transactions ? (
          <>
            <div className="grid gap-4 xl:grid-cols-12">
              <div className="space-y-4 xl:col-span-8">
                <section className="rounded-2xl bg-[#191c21] p-5 shadow-xl shadow-black/15 sm:p-6">
                  <CashFlowSummary
                    balanceCents={balanceCents}
                    incomeCents={incomeCents}
                    paidCents={expenseTotals.paidCents}
                    pendingCents={expenseTotals.openCents}
                    projectedBalanceCents={projectedBalanceCents}
                  />
                </section>
                <UpcomingExpenses
                  categoryIcons={categoryIcons}
                  dueExpenses={dueExpenses}
                  month={month}
                  pendingCents={expenseTotals.openCents}
                />
              </div>

              <section className="rounded-2xl bg-[#191c21] p-5 shadow-xl shadow-black/15 sm:p-6 xl:col-span-4">
                <h2 className="text-lg font-semibold text-white">
                  Despesas por categoria
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Distribuição dos pagamentos neste ciclo.
                </p>
                {categoryTotals.length ? (
                  <ExpenseCategoryDonut
                    categories={categoryTotals.map((category) => ({
                      category: category.category,
                      paidCents: category.paidCents.toString(),
                    }))}
                  />
                ) : (
                  <EmptyChart label="Os pagamentos por categoria aparecerão aqui." />
                )}
              </section>
            </div>

            {!hasData ? (
              <p className="text-center text-sm text-slate-500">
                Comece cadastrando receitas e despesas para preencher sua visão
                financeira.
              </p>
            ) : null}
          </>
        ) : (
          <section className="rounded-2xl bg-[#191c21] p-6 text-center shadow-xl shadow-black/15 sm:p-8">
            <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-[#272a30] text-emerald-300">
              <Icon className="size-6" name="receipt" />
            </span>
            <h2 className="mt-4 text-xl font-semibold text-white">
              Lançamentos estão desativados
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
              Ative o módulo Lançamentos nas configurações para voltar a ver
              receitas, despesas, categorias e vencimentos neste painel.
            </p>
            <Link
              className="mt-5 inline-flex rounded-xl bg-[#00e599] px-4 py-2.5 text-sm font-semibold text-[#003822]"
              href="/settings"
            >
              Abrir configurações
            </Link>
          </section>
        )}
      </section>
    );
  }
}

function UpcomingExpenses({
  categoryIcons,
  dueExpenses,
  month,
  pendingCents,
}: {
  categoryIcons: Record<string, string | null>;
  dueExpenses: ExpenseListItem[];
  month: string;
  pendingCents: bigint;
}) {
  return (
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
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-[#111319] px-3 py-2 text-right">
            <p className="text-[11px] font-medium text-slate-400">
              Total pendente
            </p>
            <p className="mt-0.5 text-base font-semibold text-amber-300">
              {formatCents(pendingCents)}
            </p>
          </div>
          <Link
            className="text-sm font-semibold text-emerald-300 transition hover:text-emerald-200"
            href={`/expenses?month=${month}`}
          >
            Ver despesas →
          </Link>
        </div>
      </div>
      {dueExpenses.length ? (
        <div className="category-scroll mt-5 max-h-[22rem] divide-y divide-white/5 overflow-y-auto pr-2">
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
                    {expense.category} · vence em {formatDate(expense.dueDate)}
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
  );
}

function CashFlowSummary({
  balanceCents,
  incomeCents,
  paidCents,
  pendingCents,
  projectedBalanceCents,
}: {
  balanceCents: bigint;
  incomeCents: bigint;
  paidCents: bigint;
  pendingCents: bigint;
  projectedBalanceCents: bigint;
}) {
  const balanceIsNegative = balanceCents < 0n;
  const projectionIsNegative = projectedBalanceCents < 0n;

  return (
    <>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-lg font-semibold text-white">Fluxo do ciclo</h2>
          <p className="mt-1 text-sm text-slate-400">
            Acompanhe os lançamentos concluídos e a projeção do ciclo.
          </p>
        </div>
        <div className="rounded-xl bg-[#111319] px-4 py-3 sm:text-right">
          <p className="text-xs font-medium text-slate-400">Saldo disponível</p>
          <p
            className={`mt-1 text-xl font-semibold tracking-tight ${balanceIsNegative ? "text-red-300" : "text-emerald-300"}`}
          >
            {formatCents(balanceCents)}
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <span className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">
          Lançamentos do ciclo
        </span>
        <span className="h-px flex-1 bg-white/5" />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <FlowStep
          icon="income"
          label="Receitas recebidas"
          tone="text-emerald-300"
          value={formatCents(incomeCents)}
        />
        <FlowStep
          icon="expense"
          label="Despesas pagas"
          tone="text-sky-200"
          value={`− ${formatCents(paidCents)}`}
        />
      </div>

      <div
        className={`mt-4 flex flex-col justify-between gap-4 rounded-xl border p-4 sm:flex-row sm:items-center ${projectionIsNegative ? "border-red-400/20 bg-red-400/5" : "border-emerald-400/20 bg-emerald-400/5"}`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex size-10 items-center justify-center rounded-xl bg-white/5 ${projectionIsNegative ? "text-red-300" : "text-emerald-300"}`}
          >
            <Icon className="size-5" name="wallet" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">
              Saldo após os próximos vencimentos
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {projectionIsNegative
                ? `Inclui ${formatCents(pendingCents)} em vencimentos ainda pendentes.`
                : `A projeção considera ${formatCents(pendingCents)} em vencimentos pendentes.`}
            </p>
          </div>
        </div>
        <p
          className={`text-2xl font-semibold tracking-tight ${projectionIsNegative ? "text-red-300" : "text-emerald-300"}`}
        >
          {formatCents(projectedBalanceCents)}
        </p>
      </div>
    </>
  );
}

function FlowStep({
  icon,
  label,
  tone,
  value,
}: {
  icon: "expense" | "income" | "receipt";
  label: string;
  tone: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-[#111319] p-4">
      <span
        className={`flex size-9 items-center justify-center rounded-lg bg-white/5 ${tone}`}
      >
        <Icon className="size-4" name={icon} />
      </span>
      <p className="mt-4 text-xs font-medium text-slate-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold tracking-tight ${tone}`}>
        {value}
      </p>
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
