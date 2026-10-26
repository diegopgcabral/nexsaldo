"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  createIncome,
  deleteIncome,
  type IncomeActionState,
  updateIncome,
} from "@/app/(financial)/income/actions";
import { DarkSelect } from "@/components/financial/dark-select";
import { Icon } from "@/components/financial/icons";
import { useToast } from "@/components/financial/toast-provider";
import {
  type IncomeListItem,
  formatCents,
  numericAmountToCents,
} from "@/lib/financial/income";
import {
  incomeCategories,
  isIncomeCategory,
} from "@/lib/financial/income-category";

type IncomeManagerProps = {
  incomes: IncomeListItem[];
  month: string;
  totalCents: bigint;
};
const initialState: IncomeActionState = {};
const incomeCategoryOptions = incomeCategories.map((category) => ({
  value: category,
  label: category,
}));

function incomeCategoryIcon(category: string) {
  switch (category) {
    case "Salário":
      return "wallet" as const;
    case "Freelance":
      return "briefcase" as const;
    case "Reembolso":
      return "receipt" as const;
    case "Rendimentos":
      return "income" as const;
    case "Reserva de emergência":
      return "shield" as const;
    case "Saldo do mês anterior":
      return "wallet" as const;
    default:
      return "more" as const;
  }
}

function formatIncomeDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(
    new Date(`${date}T12:00:00`),
  );
}

function formatCurrencyInput(value: string | number) {
  const cents = value.toString().replace(/\D/g, "");
  const amount = Number(cents || "0") / 100;

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatStoredCurrency(value: string | number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function CurrencyInput({ defaultValue }: { defaultValue?: string | number }) {
  const [value, setValue] = useState(() =>
    defaultValue === undefined ? "" : formatStoredCurrency(defaultValue),
  );

  return (
    <input
      className="income-input font-semibold"
      inputMode="numeric"
      name="amount"
      onChange={(event) => setValue(formatCurrencyInput(event.target.value))}
      placeholder="0,00"
      required
      style={{ paddingLeft: "3rem" }}
      value={value}
    />
  );
}

function IncomeForm({
  income,
  month,
  onCancel,
  onSaved,
}: {
  income?: IncomeListItem;
  month: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const action = income ? updateIncome : createIncome;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [category, setCategory] = useState(() =>
    income && isIncomeCategory(income.category) ? income.category : "Salário",
  );
  const router = useRouter();
  const { notify } = useToast();

  useEffect(() => {
    if (state.error) notify("error", state.error);
    if (state.success) {
      notify("success", income ? "Receita atualizada." : "Receita cadastrada.");
      router.refresh();
      onSaved();
    }
  }, [income, notify, onSaved, router, state.error, state.success]);

  return (
    <form
      action={formAction}
      className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-6"
    >
      <input name="month" type="hidden" value={month} />
      {income ? <input name="id" type="hidden" value={income.id} /> : null}
      <label className="space-y-1.5">
        <span className="flex items-center justify-between gap-3">
          <span className="income-label">Descrição da receita</span>
          <span className="text-xs text-emerald-300">Obrigatório</span>
        </span>
        <input
          className="income-input"
          defaultValue={income?.description}
          maxLength={200}
          name="description"
          placeholder="Ex.: Salário Tech Corp"
          required
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="income-label">Valor recebido</span>
          <span className="relative block">
            <span className="absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-semibold text-emerald-300">
              R$
            </span>
            <CurrencyInput defaultValue={income?.amount} />
          </span>
          <span className="block text-xs text-slate-500">
            Valor total desta entrada
          </span>
        </label>
        <label className="space-y-1.5">
          <span className="income-label">Data de recebimento</span>
          <input
            className="income-input [color-scheme:dark]"
            defaultValue={income?.receivedOn ?? `${month}-01`}
            name="receivedOn"
            type="date"
            required
          />
          <span className="block text-xs text-slate-500">
            Define o ciclo financeiro da receita
          </span>
        </label>
      </div>
      <div className="space-y-1.5">
        <span className="income-label" id="income-category-label">Categoria</span>
        <DarkSelect
          ariaLabelledBy="income-category-label"
          name="category"
          onChange={(value) => {
            if (isIncomeCategory(value)) setCategory(value);
          }}
          options={incomeCategoryOptions}
          placeholder="Selecione uma categoria"
          renderOptionPrefix={(option) => <Icon className="size-4 shrink-0 text-emerald-300" name={incomeCategoryIcon(option.value)} />}
          value={category}
        />
        <span className="block text-xs text-slate-500">Categorias fixas para receitas</span>
      </div>
      <label className="space-y-1.5">
        <span className="income-label">
          Observações{" "}
          <span className="font-normal text-slate-500">(opcional)</span>
        </span>
        <textarea
          className="income-input min-h-24 resize-none"
          defaultValue={income?.notes ?? ""}
          maxLength={2000}
          name="notes"
          placeholder="Notas adicionais sobre este lançamento…"
        />
      </label>
      {state.error ? (
        <p className="text-sm text-red-300">{state.error}</p>
      ) : null}
      <div className="mt-2 flex justify-end gap-3">
        <button
          className="rounded-xl bg-[#1d2025] px-5 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-[#36393f]"
          onClick={onCancel}
          type="button"
        >
          Cancelar
        </button>
        <button
          className="rounded-xl bg-[#00e599] px-6 py-2.5 text-sm font-semibold text-[#003822] shadow-[0_0_20px_rgba(0,229,153,0.24)] transition hover:brightness-110 disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending
            ? "Salvando…"
            : income
              ? "Salvar alterações"
              : "Salvar receita"}
        </button>
      </div>
    </form>
  );
}

export function IncomeManager({
  incomes,
  month,
  totalCents,
}: IncomeManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<IncomeListItem>();
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingIncome(undefined);
  };
  const openCreate = () => {
    setEditingIncome(undefined);
    setIsModalOpen(true);
  };
  const openEdit = (income: IncomeListItem) => {
    setEditingIncome(income);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-8">
      <section className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-emerald-300 uppercase">
              <span className="size-2 rounded-full bg-[#00e599]" />
              Fluxo de entrada
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Receitas
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Lançamentos consolidados do mês selecionado.
            </p>
          </div>
          <button
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#00e599] px-5 py-2.5 text-sm font-semibold text-[#003822] shadow-[0_0_24px_rgba(0,229,153,0.25)] transition hover:brightness-110 active:scale-[0.98]"
            onClick={openCreate}
            type="button"
          >
            <Icon className="size-5" name="plus" />
            Nova receita
          </button>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-[#191c21] p-6 shadow-[0_12px_36px_rgba(0,0,0,0.4)] sm:p-8">
          <div
            aria-hidden="true"
            className="absolute -right-12 -bottom-16 size-64 rounded-full bg-emerald-400/10 blur-3xl"
          />
          <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Icon className="size-5 text-emerald-300" name="wallet" />
                Total recebido no mês
              </div>
              <p className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
                {formatCents(totalCents)}
              </p>
            </div>
            <div className="rounded-xl bg-[#1d2025]/80 p-3.5 sm:min-w-52">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Lançamentos</span>
                <span className="font-semibold text-emerald-300">
                  {incomes.length}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#32353b]">
                <div
                  className="h-full rounded-full bg-[#00e599]"
                  style={{ width: incomes.length ? "100%" : "0%" }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Valores recebidos no período
              </p>
            </div>
          </div>
        </div>
      </section>
      <section>
        {incomes.length === 0 ? (
          <div className="rounded-3xl bg-[#191c21]/80 px-6 py-14 text-center shadow-xl shadow-black/20 sm:px-12">
            <div className="mx-auto flex size-20 items-center justify-center rounded-2xl bg-[#272a30] text-emerald-300 shadow-inner">
              <Icon className="size-10" name="wallet" />
            </div>
            <h2 className="mt-6 text-xl font-semibold text-white">
              Nenhuma receita neste mês
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
              Cadastre sua primeira receita para acompanhar entradas e planejar
              seu fluxo de caixa.
            </p>
            <button
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#00e599] px-5 py-3 text-sm font-semibold text-[#003822] shadow-[0_0_24px_rgba(0,229,153,0.25)] transition hover:brightness-110"
              onClick={openCreate}
              type="button"
            >
              <Icon className="size-5" name="plus" />
              Cadastrar primeira receita
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <h2 className="text-base font-semibold text-white">
                Histórico de lançamentos
              </h2>
              <span className="rounded-full bg-[#272a30] px-2 py-0.5 text-xs text-slate-400">
                {incomes.length}{" "}
                {incomes.length === 1 ? "registro" : "registros"}
              </span>
            </div>
            <ul className="space-y-3">
              {incomes.map((income) => (
                <li
                  className="group flex flex-col justify-between gap-4 rounded-2xl bg-[#191c21] p-4 shadow-sm transition hover:bg-[#1d2025] sm:flex-row sm:items-center sm:p-5"
                  key={income.id}
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#272a30] text-emerald-300 transition group-hover:bg-emerald-400/10">
                      <Icon className="size-6" name={incomeCategoryIcon(income.category)} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">
                        {income.description}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-400/10 px-2 py-0.5 font-medium text-emerald-300">
                          <Icon className="size-3" name={incomeCategoryIcon(income.category)} />
                          {income.category}
                        </span>
                        <span>{formatIncomeDate(income.receivedOn)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-white/5 pt-3 sm:justify-end sm:border-0 sm:pt-0">
                    <p className="text-lg font-semibold tracking-tight text-emerald-300">
                      + {formatCents(numericAmountToCents(income.amount))}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        aria-label={`Editar ${income.description}`}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-[#272a30] hover:text-white"
                        onClick={() => openEdit(income)}
                        type="button"
                      >
                        <Icon className="size-4" name="edit" />
                      </button>
                      <DeleteIncomeButton income={income} month={month} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      {isModalOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#0b0e13]/80 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
          role="dialog"
        >
          <aside className="ml-auto flex h-full w-full max-w-xl flex-col overflow-hidden bg-[#191c21] shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/5 bg-[#1d2025] px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
                  <Icon className="size-5" name="wallet" />
                </span>
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    {editingIncome ? "Editar receita" : "Nova receita"}
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-400">
                    Cadastre uma nova entrada financeira.
                  </p>
                </div>
              </div>
              <button
                aria-label="Fechar formulário"
                className="rounded-xl bg-[#1d2025] p-2 text-slate-400 transition hover:bg-[#36393f] hover:text-white"
                onClick={closeModal}
                type="button"
              >
                <Icon className="size-5" name="close" />
              </button>
            </div>
            <IncomeForm
              income={editingIncome}
              month={month}
              onCancel={closeModal}
              onSaved={closeModal}
            />
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function DeleteIncomeButton({
  income,
  month,
}: {
  income: IncomeListItem;
  month: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { notify } = useToast();

  function remove() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", income.id);
      formData.set("month", month);
      const result = await deleteIncome(formData);
      if (result?.error) {
        notify("error", result.error);
        return;
      }
      notify("success", "Receita excluída.");
      router.refresh();
    });
  }

  return (
    <button
      aria-label={`Excluir ${income.description}`}
      className="rounded-lg p-2 text-slate-400 transition hover:bg-red-400/10 hover:text-red-300 disabled:opacity-50"
      disabled={pending}
      onClick={remove}
      type="button"
    >
      <Icon className="size-4" name="trash" />
    </button>
  );
}
