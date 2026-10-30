"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import {
  createExpense,
  deleteExpense,
  type ExpenseActionState,
  updateExpense,
} from "@/app/(financial)/expenses/actions";
import { createExpenseCategory } from "@/app/(financial)/settings/actions";
import { CurrencyInput } from "@/components/financial/currency-input";
import { ExpenseCategoryIcon } from "@/components/financial/expense-category-icon";
import { Icon } from "@/components/financial/icons";
import { useToast } from "@/components/financial/toast-provider";
import { amountToCents } from "@/lib/financial/contracts";
import {
  calculateExpenseCategoryTotals,
  type ExpenseListItem,
  formatExpenseStatus,
} from "@/lib/financial/expense";
import { formatCents } from "@/lib/financial/income";

type Props = {
  categories: string[];
  categoryIcons: Record<string, string | null>;
  expenses: ExpenseListItem[];
  month: string;
  totals: { plannedCents: bigint; paidCents: bigint; openCents: bigint };
};
const initialState: ExpenseActionState = {};
const statuses = ["PENDING", "PAID", "CANCELLED"] as const;
const sortableColumns = [
  { key: "description", label: "Descrição" },
  { key: "category", label: "Categoria" },
  { key: "dueDate", label: "Vencimento" },
  { key: "referenceAmount", label: "Previsto" },
  { key: "paidAmount", label: "Pago" },
  { key: "status", label: "Status" },
] as const;

type ExpenseSortKey = (typeof sortableColumns)[number]["key"];
type SortDirection = "asc" | "desc";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(
    new Date(`${date}T12:00:00`),
  );
}

function todayReference() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function cents(value: string | number) {
  return amountToCents(String(value));
}

function ExpenseForm({
  expense,
  month,
  categories,
  onClose,
}: {
  expense?: ExpenseListItem;
  month: string;
  categories: string[];
  onClose: () => void;
}) {
  const action = expense ? updateExpense : createExpense;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [status, setStatus] = useState(expense?.status ?? "PENDING");
  const [description, setDescription] = useState(expense?.description ?? "");
  const [dueDate, setDueDate] = useState(
    expense?.dueDate ??
      (expense?.isRecurring ? `${month}-01` : todayReference()),
  );
  const [category, setCategory] = useState(expense?.category ?? "");
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(!expense);
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [categoryError, setCategoryError] = useState<string>();
  const [isRecurring, setIsRecurring] = useState(expense?.isRecurring ?? false);
  const [creatingCategory, startCreatingCategory] = useTransition();
  const router = useRouter();
  const { notify } = useToast();
  const normalizedCategory = category.trim().replace(/\s+/g, " ");
  const existingCategory = categoryOptions.find(
    (item) =>
      item.localeCompare(normalizedCategory, "pt-BR", {
        sensitivity: "accent",
      }) === 0,
  );
  const canCreateCategory = Boolean(normalizedCategory) && !existingCategory;
  const matchingCategories = categoryOptions.filter((item) =>
    item
      .toLocaleLowerCase("pt-BR")
      .includes(category.toLocaleLowerCase("pt-BR")),
  );

  function addCategory() {
    if (!canCreateCategory) return;
    setCategoryError(undefined);
    startCreatingCategory(async () => {
      const formData = new FormData();
      formData.set("name", normalizedCategory);
      const result = await createExpenseCategory({}, formData);
      if (result.error) {
        setCategoryError(result.error);
        notify("error", result.error);
        return;
      }
      setCategoryOptions((items) => [...items, normalizedCategory].sort());
      setCategory(normalizedCategory);
      setIsCategoryMenuOpen(false);
      notify("success", `Categoria “${normalizedCategory}” cadastrada.`);
      router.refresh();
    });
  }
  useEffect(() => {
    if (state.error) notify("error", state.error);
    if (state.success) {
      notify(
        "success",
        expense ? "Despesa atualizada." : "Despesa cadastrada.",
      );
      onClose();
    }
  }, [expense, notify, onClose, router, state.error, state.success]);
  return (
    <form
      action={formAction}
      className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-6"
    >
      <input name="month" type="hidden" value={month} />
      {expense ? <input name="id" type="hidden" value={expense.id} /> : null}
      <label className="space-y-1.5">
        <span className="income-label">Descrição da despesa</span>
        <input
          className="income-input"
          name="description"
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Ex.: Fatura, aluguel, supermercado…"
          required
          value={description}
        />
      </label>
      <div className="relative space-y-1.5">
        <span className="flex items-center justify-between gap-3">
          <span className="income-label">Categoria</span>
          <a
            className="text-xs text-emerald-300 hover:text-emerald-200"
            href="/settings"
          >
            Gerenciar categorias
          </a>
        </span>
        <div className="relative">
          <Icon
            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-slate-400"
            name="search"
          />
          <input
            className="income-input category-search-input"
            name="category"
            onChange={(event) => {
              setCategory(event.target.value);
              setIsCategoryMenuOpen(true);
            }}
            onFocus={() => setIsCategoryMenuOpen(true)}
            placeholder="Buscar ou criar categoria"
            required
            value={category}
          />
          <button
            aria-label={
              isCategoryMenuOpen ? "Fechar categorias" : "Abrir categorias"
            }
            className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white"
            onClick={() => setIsCategoryMenuOpen((open) => !open)}
            type="button"
          >
            <Icon
              className="size-4"
              name={isCategoryMenuOpen ? "chevronUp" : "chevronDown"}
            />
          </button>
        </div>
        {isCategoryMenuOpen ? (
          <div className="relative z-10 overflow-hidden rounded-2xl border border-white/8 bg-[#0b0e13] p-2 shadow-2xl">
            {canCreateCategory ? (
              <button
                className="mb-1 flex w-full items-center gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-left transition hover:bg-emerald-400/15 disabled:opacity-60"
                disabled={creatingCategory}
                onClick={addCategory}
                type="button"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#00e599] text-[#003822]">
                  <Icon className="size-4" name="plus" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-100">
                    {creatingCategory
                      ? "Criando categoria…"
                      : `Criar “${normalizedCategory}”`}
                  </span>
                  <span className="block text-xs text-emerald-300">
                    Criar e selecionar automaticamente
                  </span>
                </span>
                <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                  Novo
                </span>
              </button>
            ) : null}
            <div className="category-scroll max-h-56 overflow-y-auto pr-1">
              {matchingCategories.length ? (
                matchingCategories.map((item) => (
                  <button
                    className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-[#1d2025]"
                    key={item}
                    onClick={() => {
                      setCategory(item);
                      setCategoryError(undefined);
                      setIsCategoryMenuOpen(false);
                    }}
                    type="button"
                  >
                    <ExpenseCategoryIcon name={item} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-100">
                      {item}
                    </span>
                    <span className="text-xs text-slate-500">Selecionar</span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-5 text-center text-sm text-slate-500">
                  Nenhuma categoria encontrada.
                </p>
              )}
            </div>
          </div>
        ) : null}
        {categoryError ? (
          <span className="block text-xs text-red-300">{categoryError}</span>
        ) : null}
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/8 bg-[#111319] p-4 transition hover:border-emerald-400/35">
        <input
          checked={isRecurring}
          className="mt-0.5 size-4 accent-emerald-400"
          name="isRecurring"
          onChange={(event) => {
            const nextValue = event.target.checked;
            setIsRecurring(nextValue);
            if (!nextValue) setStatus("PAID");
          }}
          type="checkbox"
        />
        <span>
          <span className="block text-sm font-semibold text-slate-100">
            Repetir mensalmente
          </span>
          <span className="mt-0.5 block text-xs leading-5 text-slate-400">
            Ao salvar, a despesa deste ciclo e a do próximo ciclo serão criadas.
          </span>
        </span>
      </label>
      <div className={isRecurring ? "grid gap-4 sm:grid-cols-2" : "grid gap-4"}>
        {isRecurring ? (
          <label className="space-y-1.5">
            <span className="income-label">Valor previsto</span>
            <CurrencyInput
              defaultValue={expense?.referenceAmount}
              name="referenceAmount"
              required
            />
          </label>
        ) : null}
        <label className="space-y-1.5">
          <span className="income-label">Valor pago</span>
          <CurrencyInput
            defaultValue={expense?.paidAmount ?? "0"}
            name="paidAmount"
            required={!isRecurring}
          />
        </label>
      </div>
      <label className="space-y-1.5">
        <span className="income-label">
          {isRecurring ? "Data de vencimento" : "Data do pagamento"}
        </span>
        <input
          className="income-input [color-scheme:dark]"
          name="dueDate"
          onChange={(event) => setDueDate(event.target.value)}
          type="date"
          required
          value={dueDate}
        />
      </label>
      {isRecurring ? (
      <fieldset>
        <legend className="income-label mb-2">Status do pagamento</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {statuses.map((item) => (
            <label
              className={`cursor-pointer rounded-xl border p-3 text-center text-xs transition ${status === item ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300" : "border-white/5 bg-[#111319] text-slate-400"}`}
              key={item}
            >
              <input
                checked={status === item}
                className="sr-only"
                name="status"
                onChange={() => setStatus(item)}
                type="radio"
                value={item}
              />
              <span>{formatExpenseStatus(item)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      ) : (
        <input name="status" type="hidden" value="PAID" />
      )}
      <label className="space-y-1.5">
        <span className="income-label">
          Observações{" "}
          <span className="font-normal text-slate-500">(opcional)</span>
        </span>
        <textarea
          className="income-input min-h-24 resize-none"
          defaultValue={expense?.notes ?? ""}
          name="notes"
        />
      </label>
      {state.error ? (
        <p className="text-sm text-red-300">{state.error}</p>
      ) : null}
      <div className="mt-auto flex justify-end gap-3 pt-2">
        <button
          className="rounded-xl bg-[#272a30] px-5 py-2.5 text-sm text-slate-200"
          onClick={onClose}
          type="button"
        >
          Cancelar
        </button>
        <button
          className="rounded-xl bg-[#00e599] px-6 py-2.5 text-sm font-semibold text-[#003822] disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Salvando…" : "Salvar despesa"}
        </button>
      </div>
    </form>
  );
}

export function ExpenseManager({
  categories,
  categoryIcons,
  expenses,
  month,
  totals,
}: Props) {
  const [drawer, setDrawer] = useState(false);
  const [editing, setEditing] = useState<ExpenseListItem>();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"ALL" | ExpenseListItem["status"]>(
    "ALL",
  );
  const [sortKey, setSortKey] = useState<ExpenseSortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const visible = useMemo(() => {
    const matchingExpenses = expenses.filter(
      (item) =>
        (filter === "ALL" || item.status === filter) &&
        `${item.description} ${item.category}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );

    if (!sortKey) return matchingExpenses;

    return matchingExpenses.sort((left, right) => {
      const value =
        sortKey === "referenceAmount" || sortKey === "paidAmount"
          ? cents(left[sortKey]) === cents(right[sortKey])
            ? 0
            : cents(left[sortKey]) > cents(right[sortKey])
              ? 1
              : -1
          : String(left[sortKey]).localeCompare(
              String(right[sortKey]),
              "pt-BR",
              {
                sensitivity: "base",
              },
            );

      return sortDirection === "asc" ? value : -value;
    });
  }, [expenses, filter, query, sortDirection, sortKey]);
  const changeSort = (nextKey: ExpenseSortKey) => {
    if (nextKey === sortKey) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection("asc");
  };
  const open = (expense?: ExpenseListItem) => {
    setEditing(expense);
    setDrawer(true);
  };
  const close = () => {
    setDrawer(false);
    setEditing(undefined);
  };
  const paidPercent = totals.plannedCents
    ? Number((totals.paidCents * 100n) / totals.plannedCents)
    : 0;
  const categoryTotals = calculateExpenseCategoryTotals(expenses, [
    ...new Set(expenses.map((expense) => expense.category)),
  ]);
  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 text-xs font-semibold tracking-[0.18em] text-emerald-300 uppercase">
            Gestão mensal
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Despesas
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Controle de pagamentos e compromissos do mês selecionado.
          </p>
        </div>
        <button
          className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#00e599] px-5 py-2.5 text-sm font-semibold text-[#003822] shadow-[0_0_24px_rgba(0,229,153,0.25)]"
          onClick={() => open()}
          type="button"
        >
          <Icon className="size-5" name="plus" />
          Nova despesa
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Metric
          label="Total previsto"
          value={totals.plannedCents}
          note={`${expenses.filter((item) => item.status !== "CANCELLED").length} compromissos mapeados`}
          color="text-white"
        />
        <Metric
          label="Total pago"
          value={totals.paidCents}
          note={`${paidPercent}% liquidado`}
          color="text-emerald-300"
        />
        <Metric
          label="Em aberto"
          value={totals.openCents}
          note={`${expenses.filter((item) => item.status === "PENDING").length} despesas pendentes`}
          color="text-sky-200"
        />
      </div>
      {categoryTotals.length ? (
        <section className="rounded-2xl bg-[#191c21]/80 p-4 shadow-lg shadow-black/15">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Totais por categoria
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Apenas lançamentos quitados neste ciclo
              </p>
            </div>
            <div className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex">
              <span>Role para ver todas</span>
              <Icon className="size-4 text-emerald-300" name="chevronRight" />
            </div>
          </div>
          <div className="category-scroll flex gap-2 overflow-x-auto pb-2">
            {categoryTotals.map((categoryTotal) => (
              <div
                className="min-w-52 rounded-xl border border-white/5 bg-[#111319] p-3"
                key={categoryTotal.category}
              >
                <div className="flex items-start gap-2">
                  <ExpenseCategoryIcon
                    compact
                    iconKey={categoryIcons[categoryTotal.category]}
                    name={categoryTotal.category}
                  />
                  <div className="min-w-0">
                    <p className="min-h-8 text-sm leading-4 font-semibold text-slate-100">
                      {categoryTotal.category}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {categoryTotal.expenseCount} lançamento
                      {categoryTotal.expenseCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 border-t border-white/5 pt-2.5">
                  <p className="text-[11px] text-slate-500">Total pago</p>
                  <p className="mt-0.5 text-base font-semibold text-emerald-300">
                    {formatCents(categoryTotal.paidCents)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <div className="flex flex-col gap-3 rounded-xl bg-[#191c21]/80 p-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-xs">
          <Icon
            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-slate-400"
            name="search"
          />
          <input
            className="income-input category-search-input"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filtrar lançamentos…"
            value={query}
          />
          {query ? (
            <button
              aria-label="Limpar filtro"
              className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
              onClick={() => setQuery("")}
              type="button"
            >
              <Icon className="size-4" name="close" />
            </button>
          ) : null}
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {(["ALL", ...statuses] as const).map((item) => (
            <button
              className={`rounded-lg px-3 py-1.5 text-xs whitespace-nowrap ${filter === item ? "bg-[#00e599] font-semibold text-[#003822]" : "bg-[#272a30] text-slate-400"}`}
              key={item}
              onClick={() => setFilter(item)}
              type="button"
            >
              {item === "ALL" ? "Todas" : formatExpenseStatus(item)}
            </button>
          ))}
        </div>
      </div>
      {visible.length === 0 ? (
        <div className="rounded-3xl bg-[#191c21] p-14 text-center">
          <h2 className="text-xl font-semibold text-white">
            Nenhuma despesa encontrada
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Cadastre um compromisso financeiro para começar.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-[#191c21] shadow-xl shadow-black/20">
          <table className="w-full min-w-245 text-left text-sm">
            <thead className="bg-[#272a30]/70 text-xs tracking-wider text-slate-400 uppercase">
              <tr>
                {sortableColumns.map(({ key, label }) => (
                  <th
                    aria-sort={
                      sortKey === key
                        ? sortDirection === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className="px-4 py-3.5 font-semibold first:px-5"
                    key={key}
                  >
                    <button
                      aria-label={`Ordenar por ${label} em ordem ${sortKey === key && sortDirection === "asc" ? "decrescente" : "crescente"}`}
                      className={`inline-flex items-center gap-1.5 transition hover:text-slate-100 ${sortKey === key ? "text-emerald-300" : ""}`}
                      onClick={() => changeSort(key)}
                      type="button"
                    >
                      {label}
                      <Icon
                        className={`size-3.5 ${sortKey === key ? "opacity-100" : "opacity-45"}`}
                        name={
                          sortKey === key && sortDirection === "desc"
                            ? "chevronDown"
                            : "chevronUp"
                        }
                      />
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3.5 font-semibold normal-case">
                  Recorrência
                </th>
                <th className="px-5 py-3.5 font-semibold">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr
                  className="border-t border-white/5 transition hover:bg-[#1d2025]"
                  key={item.id}
                >
                  <td className="px-5 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <ExpenseCategoryIcon
                        iconKey={categoryIcons[item.category]}
                        name={item.category}
                      />
                      <span
                        className={`font-semibold ${item.status === "CANCELLED" ? "text-slate-500 line-through" : "text-white"}`}
                      >
                        {item.description}
                      </span>
                    </div>
                  </td>
                  <td className="min-w-42 px-4 py-4">
                    <span className="inline-flex rounded-md bg-[#272a30] px-2 py-1 text-xs whitespace-nowrap text-slate-300">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-300">
                    {formatDate(item.dueDate)}
                  </td>
                  <td className="px-4 py-4 font-medium text-white">
                    {item.isRecurring
                      ? formatCents(cents(item.referenceAmount))
                      : "—"}
                  </td>
                  <td className="px-4 py-4">
                    <PaymentComparison expense={item} />
                  </td>
                  <td className="px-4 py-4">
                    <Status status={item.status} />
                  </td>
                  <td className="px-4 py-4">
                    {item.isRecurring ? (
                      <span className="inline-flex rounded-full bg-violet-400/12 px-2.5 py-1 text-xs font-medium text-violet-200">
                        Mensal
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-1">
                      <button
                        aria-label={`Editar ${item.description}`}
                        className="rounded-lg p-2 text-slate-400 hover:bg-[#272a30] hover:text-white"
                        onClick={() => open(item)}
                        type="button"
                      >
                        <Icon className="size-4" name="edit" />
                      </button>
                      <DeleteExpenseButton expense={item} month={month} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {drawer ? (
        <div
          className="fixed inset-0 z-50 bg-[#0b0e13]/80 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <aside
            aria-modal="true"
            className="ml-auto flex h-full w-full max-w-xl flex-col bg-[#191c21] shadow-2xl"
            role="dialog"
          >
            <header className="flex items-center justify-between border-b border-white/5 bg-[#1d2025] px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
                  <Icon className="size-5" name="receipt" />
                </span>
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    {editing ? "Editar despesa" : "Nova despesa"}
                  </h2>
                  <p className="text-sm text-slate-400">
                    Cadastre um novo compromisso financeiro.
                  </p>
                </div>
              </div>
              <button
                aria-label="Fechar formulário"
                className="rounded-xl bg-[#272a30] p-2 text-slate-400"
                onClick={close}
                type="button"
              >
                <Icon className="size-5" name="close" />
              </button>
            </header>
            <ExpenseForm
              categories={categories}
              expense={editing}
              month={month}
              onClose={close}
            />
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function DeleteExpenseButton({
  expense,
  month,
}: {
  expense: ExpenseListItem;
  month: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { notify } = useToast();

  function remove() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", expense.id);
      formData.set("month", month);
      const result = await deleteExpense(formData);
      if (result?.error) {
        notify("error", result.error);
        return;
      }
      notify("success", "Despesa excluída.");
      router.refresh();
    });
  }

  return (
    <button
      aria-label={`Excluir ${expense.description}`}
      className="rounded-lg p-2 text-slate-400 hover:bg-red-400/10 hover:text-red-300 disabled:opacity-50"
      disabled={pending}
      onClick={remove}
      type="button"
    >
      <Icon className="size-4" name="trash" />
    </button>
  );
}

function Metric({
  label,
  value,
  note,
  color,
}: {
  label: string;
  value: bigint;
  note: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl bg-[#191c21] p-6 shadow-lg shadow-black/20">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-bold tracking-tight ${color}`}>
        {formatCents(value)}
      </p>
      <p className="mt-3 text-xs text-slate-400">{note}</p>
    </div>
  );
}
function Status({ status }: { status: ExpenseListItem["status"] }) {
  const colors = {
    PENDING: "bg-sky-300/15 text-sky-200",
    PAID: "bg-emerald-400/15 text-emerald-300",
    CANCELLED: "bg-[#32353b] text-slate-400",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${colors[status]}`}
    >
      {formatExpenseStatus(status)}
    </span>
  );
}

function PaymentComparison({ expense }: { expense: ExpenseListItem }) {
  if (expense.status === "CANCELLED") {
    return <span className="text-slate-500">—</span>;
  }

  const paidCents = cents(expense.paidAmount);
  const plannedCents = cents(expense.referenceAmount);
  const comparison =
    paidCents > plannedCents
      ? {
          label: "Acima do previsto",
          tone: "bg-red-300",
        }
      : paidCents < plannedCents
        ? {
            label: "Abaixo do previsto",
            tone: "bg-sky-200",
          }
        : {
            label: "Igual ao previsto",
            tone: "bg-emerald-300",
          };

  return (
    <span className="flex items-center gap-2 font-medium text-emerald-300">
      <span
        aria-label={comparison.label}
        className={`size-2 shrink-0 rounded-full ${comparison.tone}`}
        role="img"
        title={comparison.label}
      />
      <span>{formatCents(paidCents)}</span>
      <span className="sr-only">{comparison.label}</span>
    </span>
  );
}
