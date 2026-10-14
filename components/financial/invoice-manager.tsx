"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import {
  deletePurchase,
  savePurchase,
  setSplitPayment,
  type PurchaseActionState,
} from "@/app/(financial)/invoices/actions";
import { DarkSelect } from "@/components/financial/dark-select";
import { ExpenseCategoryIcon } from "@/components/financial/expense-category-icon";
import { Icon } from "@/components/financial/icons";
import { useToast } from "@/components/financial/toast-provider";
import type { CreditCardListItem } from "@/lib/financial/credit-card";
import type {
  PurchaseListItem,
  PurchaseSplit,
} from "@/lib/financial/credit-card-invoice";
import {
  calculateSplitBalance,
  invoiceAmountToCents,
  summarizeInvoice,
} from "@/lib/financial/credit-card-invoice";
import { formatCents } from "@/lib/financial/income";
import { addMonths, formatMonthReference } from "@/lib/financial/month";
import type { ParticipantListItem } from "@/lib/financial/participant";

const centsOrZero = invoiceAmountToCents;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${value}T12:00:00`));
}

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
function formatTypingMoney(raw: string) {
  return moneyFormatter.format(Number(raw.replace(/\D/g, "") || "0") / 100);
}
function formatStoredMoney(raw: string) {
  return moneyFormatter.format(Number(raw));
}

function PurchaseForm({
  cardId,
  month,
  purchase,
  participants,
  ownerName,
  onClose,
}: {
  cardId: string;
  month: string;
  purchase?: PurchaseListItem;
  participants: ParticipantListItem[];
  ownerName: string;
  onClose: () => void;
}) {
  const [description, setDescription] = useState(purchase?.description ?? "");
  const [amount, setAmount] = useState(
    purchase ? formatStoredMoney(purchase.amount) : "",
  );
  const [purchasedOn, setPurchasedOn] = useState(
    purchase?.purchasedOn ?? new Date().toLocaleDateString("en-CA"),
  );
  const [invoiceMonth, setInvoiceMonth] = useState(
    purchase?.invoiceMonth ?? month,
  );
  const [installmentCount, setInstallmentCount] = useState(
    purchase?.installmentCount ?? 1,
  );
  const [installmentNumber, setInstallmentNumber] = useState(
    purchase?.installmentNumber ?? 1,
  );
  const [splits, setSplits] = useState<PurchaseSplit[]>(
    purchase?.splits.length
      ? purchase.splits.map((split) => ({
          ...split,
          amount: formatStoredMoney(split.amount),
        }))
      : [
          {
            participantId: null,
            amount: purchase ? formatStoredMoney(purchase.amount) : "",
          },
        ],
  );
  const [state, formAction, pending] = useActionState<
    PurchaseActionState,
    FormData
  >(savePurchase, {});
  const router = useRouter();
  const { notify } = useToast();
  const { total, allocated, difference } = calculateSplitBalance(
    amount,
    splits,
  );

  useEffect(() => {
    if (state.success) {
      notify("success", purchase ? "Compra atualizada." : "Compra cadastrada.");
      router.refresh();
      onClose();
    }
  }, [state.success, purchase, notify, router, onClose]);

  function updateSplit(index: number, changes: Partial<PurchaseSplit>) {
    setSplits((current) =>
      current.map((split, position) =>
        position === index ? { ...split, ...changes } : split,
      ),
    );
  }

  const selectable = participants.filter(
    (person) =>
      person.isActive ||
      splits.some((split) => split.participantId === person.id),
  );
  const payload = JSON.stringify({
    id: purchase?.id ?? null,
    cardId,
    description,
    amount,
    purchasedOn,
    invoiceMonth,
    installmentNumber,
    installmentCount,
    splits,
  });

  return (
    <form action={formAction} className="space-y-5">
      <input name="purchase" type="hidden" value={payload} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 sm:col-span-2">
          <span className="block text-sm text-slate-200">
            Descrição da compra
          </span>
          <input
            autoFocus
            className="w-full rounded-xl border border-white/10 bg-[#111319] px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
            maxLength={160}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Ex.: Supermercado"
            required
            value={description}
          />
        </label>
        <label className="space-y-2">
          <span className="block text-sm text-slate-200">Parcela atual</span>
          {purchase ? (
            <div className="rounded-xl border border-white/10 bg-[#111319] px-4 py-3 text-sm text-slate-300">
              Parcela {purchase.installmentNumber}/{purchase.installmentCount}
            </div>
          ) : (
            <input
              className="w-full rounded-xl border border-white/10 bg-[#111319] px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
              max={installmentCount}
              min={1}
              onChange={(event) =>
                setInstallmentNumber(
                  Math.min(
                    installmentCount,
                    Math.max(1, Number(event.target.value) || 1),
                  ),
                )
              }
              type="number"
              value={installmentNumber}
            />
          )}
        </label>
        <label className="space-y-2">
          <span className="block text-sm text-slate-200">
            Total de parcelas
          </span>
          {purchase ? (
            <div className="rounded-xl border border-white/10 bg-[#111319] px-4 py-3 text-sm text-slate-300">
              {purchase.installmentCount} parcelas
            </div>
          ) : (
            <input
              className="w-full rounded-xl border border-white/10 bg-[#111319] px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
              max={120}
              min={1}
              onChange={(event) => {
                const nextCount = Math.min(
                  120,
                  Math.max(1, Number(event.target.value) || 1),
                );
                setInstallmentCount(nextCount);
                setInstallmentNumber((current) => Math.min(current, nextCount));
              }}
              type="number"
              value={installmentCount}
            />
          )}
        </label>
        <p className="-mt-2 text-xs text-slate-500 sm:col-span-2">
          <span className="block text-xs text-slate-500">
            {purchase
              ? "Esta parcela pode ser ajustada sem modificar as demais."
              : installmentCount === 1
                ? "Compra à vista."
                : `Serão criadas as parcelas ${installmentNumber}/${installmentCount} até ${installmentCount}/${installmentCount}, com o mesmo rateio.`}
          </span>
        </p>
        <label className="space-y-2">
          <span className="block text-sm text-slate-200">Valor total (R$)</span>
          <span className="relative block">
            <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm font-semibold text-emerald-300">
              R$
            </span>
            <input
              className="w-full rounded-xl border border-white/10 bg-[#111319] py-3 pr-4 pl-10 text-sm font-semibold text-white outline-none focus:border-emerald-400"
              inputMode="numeric"
              onChange={(event) => {
                const formatted = formatTypingMoney(event.target.value);
                setAmount(formatted);
                if (splits.length === 1 && splits[0].participantId === null)
                  setSplits([{ participantId: null, amount: formatted }]);
              }}
              placeholder="0,00"
              required
              value={amount}
            />
          </span>
        </label>
        <label className="space-y-2">
          <span className="block text-sm text-slate-200">Data da compra</span>
          <input
            className="w-full rounded-xl border border-white/10 bg-[#111319] px-4 py-3 text-sm text-white scheme-dark outline-none focus:border-emerald-400"
            onChange={(event) => setPurchasedOn(event.target.value)}
            required
            type="date"
            value={purchasedOn}
          />
        </label>
        <label className="space-y-2 sm:col-span-2">
          <span className="block text-sm text-slate-200">Mês da fatura</span>
          <input
            className="w-full rounded-xl border border-white/10 bg-[#111319] px-4 py-3 text-sm text-white scheme-dark outline-none focus:border-emerald-400"
            onChange={(event) => setInvoiceMonth(event.target.value)}
            required
            type="month"
            value={invoiceMonth}
          />
          <span className="block text-xs text-slate-500">
            Escolha o mês em que a compra deve aparecer, independentemente da
            data da compra.
          </span>
        </label>
      </div>
      <div className="space-y-3 border-t border-white/10 pt-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">Divisão por pessoa</h3>
          <span className="text-xs text-slate-400">Valores editáveis</span>
        </div>
        {splits.map((split, index) => (
          <div
            className="flex items-center gap-2"
            key={`${split.participantId ?? "owner"}-${index}`}
          >
            <div className="min-w-0 flex-1">
              <span className="sr-only" id={`split-person-${index}`}>
                Pessoa
              </span>
              <DarkSelect
                ariaLabelledBy={`split-person-${index}`}
                name={`split-person-${index}`}
                showPersonIcon
                onChange={(value) =>
                  updateSplit(index, {
                    participantId: value === "owner" ? null : value,
                  })
                }
                options={[
                  { value: "owner", label: `${ownerName} (titular)` },
                  ...selectable.map((person) => ({
                    value: person.id,
                    label: person.name,
                  })),
                ]}
                placeholder="Selecione"
                value={split.participantId ?? "owner"}
              />
            </div>
            <span className="relative block w-32 shrink-0">
              <span className="absolute top-1/2 left-2 -translate-y-1/2 text-xs font-semibold text-emerald-300">
                R$
              </span>
              <input
                aria-label={`Valor da parte ${index + 1}`}
                className="w-full rounded-xl border border-white/10 bg-[#111319] py-3 pr-2 pl-7 text-right text-sm text-white outline-none focus:border-emerald-400"
                inputMode="numeric"
                onChange={(event) =>
                  updateSplit(index, {
                    amount: formatTypingMoney(event.target.value),
                  })
                }
                placeholder="0,00"
                value={split.amount}
              />
            </span>
            <button
              aria-label={`Remover parte ${index + 1}`}
              className="rounded-lg p-2 text-slate-400 hover:bg-red-400/10 hover:text-red-300 disabled:opacity-30"
              disabled={splits.length === 1}
              onClick={() =>
                setSplits((current) =>
                  current.filter((_, position) => position !== index),
                )
              }
              type="button"
            >
              <Icon className="size-4" name="trash" />
            </button>
          </div>
        ))}
        <button
          className="rounded-xl bg-white/5 px-4 py-2 text-xs text-emerald-300 hover:bg-white/10"
          disabled={splits.length >= selectable.length + 1}
          onClick={() => {
            const used = new Set(splits.map((split) => split.participantId));
            const person = selectable.find((item) => !used.has(item.id));
            if (person)
              setSplits((current) => [
                ...current,
                { participantId: person.id, amount: "" },
              ]);
          }}
          type="button"
        >
          + Adicionar pessoa
        </button>
        <div
          className={`rounded-xl p-3 text-sm ${difference === 0n && total > 0n ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-200"}`}
        >
          <div className="flex justify-between">
            <span>Valor da compra</span>
            <strong>{formatCents(total)}</strong>
          </div>
          <div className="mt-1 flex justify-between">
            <span>Soma das partes</span>
            <strong>{formatCents(allocated)}</strong>
          </div>
          <p className="mt-2 border-t border-current/10 pt-2 text-xs">
            {difference === 0n && total > 0n
              ? "Divisão exata — pronto para salvar."
              : `Diferença: ${formatCents(difference)}`}
          </p>
        </div>
      </div>
      {state.error ? (
        <p className="text-sm text-red-300" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="flex justify-end gap-3">
        <button
          className="rounded-xl bg-white/10 px-4 py-2.5 text-sm text-white"
          onClick={onClose}
          type="button"
        >
          Cancelar
        </button>
        <button
          className="rounded-xl bg-[#00e599] px-5 py-2.5 text-sm font-semibold text-[#003822] disabled:opacity-50"
          disabled={
            pending ||
            total <= 0n ||
            difference !== 0n ||
            !description.trim() ||
            !purchasedOn ||
            !invoiceMonth
          }
          type="submit"
        >
          {pending ? "Salvando…" : "Salvar compra"}
        </button>
      </div>
    </form>
  );
}

export function InvoiceManager({
  cards,
  selectedCardId,
  month,
  participants,
  ownerName,
  purchases,
  loadError,
  categories,
}: {
  cards: CreditCardListItem[];
  selectedCardId: string;
  month: string;
  participants: ParticipantListItem[];
  ownerName: string;
  purchases: PurchaseListItem[];
  loadError: boolean;
  categories: { name: string; iconKey: string | null }[];
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [editing, setEditing] = useState<PurchaseListItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirming, setConfirming] = useState<PurchaseListItem | null>(null);
  const [settling, setSettling] = useState<PurchaseSplit | null>(null);
  const [includeExpense, setIncludeExpense] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState("");
  const [busy, startTransition] = useTransition();
  const selectedCard = cards.find((card) => card.id === selectedCardId);
  const people = useMemo(
    () => new Map(participants.map((person) => [person.id, person.name])),
    [participants],
  );
  const summary = summarizeInvoice(purchases);
  const total = summary.total;
  const totalsByPerson = new Map<string, bigint>();
  const paidByPerson = new Map<string, bigint>();
  for (const [id, byCard] of summary.personCardTotals)
    totalsByPerson.set(id, byCard.get(selectedCardId) ?? 0n);
  for (const [id, byCard] of summary.personCardPaidTotals)
    paidByPerson.set(id, byCard.get(selectedCardId) ?? 0n);
  function goTo(cardId: string, nextMonth = month) {
    router.push(`/invoices/${encodeURIComponent(cardId)}?month=${nextMonth}`);
  }
  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }
  function removePurchase() {
    if (!confirming) return;
    startTransition(async () => {
      const result = await deletePurchase(confirming.id);
      if (result.error) notify("error", result.error);
      else {
        notify("success", "Compra excluída.");
        router.refresh();
      }
      setConfirming(null);
    });
  }

  function updateSplitPayment(
    split: PurchaseSplit,
    isPaid: boolean,
    category?: string,
  ) {
    if (!split.id) return;
    startTransition(async () => {
      const result = await setSplitPayment(split.id!, isPaid, category);
      if (result.error) notify("error", result.error);
      else {
        notify(
          "success",
          isPaid
            ? "Parcela marcada como paga."
            : "Parcela marcada como em aberto.",
        );
        router.refresh();
      }
      setSettling(null);
      setIncludeExpense(false);
      setExpenseCategory("");
    });
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-emerald-400 uppercase">
            Cartões de crédito / Faturas
          </p>
          <h1 className="text-3xl font-bold text-white">
            {selectedCard?.name ?? "Fatura"}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Compras e rateios deste cartão em {formatMonthReference(month)}.
          </p>
        </div>
        {selectedCard ? (
          <button
            className="rounded-xl bg-[#00e599] px-5 py-3 text-sm font-semibold text-[#003822]"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            type="button"
          >
            + Adicionar compra
          </button>
        ) : null}
      </header>
      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          className="rounded-lg px-3 py-2 text-slate-400 hover:text-white"
          href="/cards"
        >
          Meus cartões
        </Link>
        <Link
          className="rounded-lg px-3 py-2 text-slate-400 hover:text-white"
          href="/participants"
        >
          Participantes
        </Link>
        <Link
          className="rounded-lg bg-emerald-400/10 px-3 py-2 text-emerald-300"
          href={`/invoices?month=${month}`}
        >
          ← Todas as faturas
        </Link>
      </div>
      {loadError ? (
        <p
          className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200"
          role="alert"
        >
          Não foi possível carregar a fatura. Tente atualizar a página.
        </p>
      ) : null}
      {cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-[#1d2026] p-10 text-center">
          <h2 className="font-semibold text-white">
            Cadastre um cartão primeiro
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            As compras e faturas serão organizadas por cartão.
          </p>
          <Link
            className="mt-5 inline-block rounded-xl bg-[#00e599] px-4 py-2.5 text-sm font-semibold text-[#003822]"
            href="/cards"
          >
            Cadastrar cartão
          </Link>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-white/5 bg-[#1d2026] p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                  Cartão selecionado
                </p>
                <h2 className="mt-1 font-semibold text-white">
                  {selectedCard?.name}{" "}
                  {selectedCard?.name !== selectedCard?.bankName ? (
                    <span className="text-sm font-normal text-slate-400">
                      · {selectedCard?.bankName}
                    </span>
                  ) : null}
                </h2>
              </div>
              <div className="w-full max-w-xs">
                <span className="mb-2 block text-xs font-semibold tracking-wider text-slate-400 uppercase">
                  Mês da fatura
                </span>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#111319] px-2 py-2 text-sm text-white">
                  <button
                    aria-label="Mês anterior"
                    className="rounded-lg p-2 hover:bg-white/10"
                    onClick={() => goTo(selectedCardId, addMonths(month, -1))}
                    type="button"
                  >
                    <Icon className="size-4" name="chevronLeft" />
                  </button>
                  <span>{formatMonthReference(month)}</span>
                  <button
                    aria-label="Próximo mês"
                    className="rounded-lg p-2 hover:bg-white/10"
                    onClick={() => goTo(selectedCardId, addMonths(month, 1))}
                    type="button"
                  >
                    <Icon className="size-4" name="chevronRight" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]">
            <div className="rounded-2xl border border-white/5 bg-[#1d2026] p-5">
              <p className="text-xs tracking-wider text-slate-400 uppercase">
                Total da fatura
              </p>
              <p className="mt-3 text-3xl font-bold text-white">
                {formatCents(total)}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                {purchases.length}{" "}
                {purchases.length === 1 ? "compra" : "compras"} ·{" "}
                {selectedCard?.dueDay
                  ? `Vence dia ${selectedCard.dueDay}`
                  : "Vencimento não informado"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-[#1d2026] p-5">
              <h2 className="font-semibold text-white">Resumo por pessoa</h2>
              {totalsByPerson.size ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from(totalsByPerson).map(([id, amount]) => {
                    const paid = paidByPerson.get(id) ?? 0n;
                    const outstanding = amount - paid;
                    return (
                      <div className="rounded-xl bg-[#111319] p-3" key={id}>
                        <p className="truncate text-xs text-slate-400">
                          {id === "owner"
                            ? ownerName
                            : (people.get(id) ?? "Participante arquivado")}
                        </p>
                        <div className="mt-1 flex justify-between text-sm">
                          <span className="text-slate-300">Total</span>
                          <strong className="text-white">
                            {formatCents(amount)}
                          </strong>
                        </div>
                        {paid > 0n ? (
                          <div className="mt-1 flex justify-between text-xs">
                            <span className="text-slate-500">(-) Pago</span>
                            <span className="text-emerald-300">
                              {formatCents(paid)}
                            </span>
                          </div>
                        ) : null}
                        <div className="mt-2 flex justify-between border-t border-white/10 pt-2 text-xs font-semibold">
                          <span className="text-slate-400">Em aberto</span>
                          <span className="text-amber-200">
                            {formatCents(outstanding)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-400">
                  Sem valores neste mês.
                </p>
              )}
            </div>
          </div>
          <section className="rounded-2xl border border-white/5 bg-[#1d2026] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-white">Compras da fatura</h2>
              <span className="text-xs text-slate-400">
                {purchases.length} lançamentos
              </span>
            </div>
            {purchases.length ? (
              <div className="space-y-2">
                {purchases.map((purchase) => (
                  <div
                    className="rounded-xl border border-white/5 bg-[#111319] p-4"
                    key={purchase.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">
                          {purchase.description}
                          {purchase.installmentCount > 1 ? (
                            <span className="ml-2 rounded-full bg-violet-400/10 px-2 py-0.5 text-xs font-semibold text-violet-200">
                              {purchase.installmentNumber}/
                              {purchase.installmentCount}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {formatDate(purchase.purchasedOn)} ·{" "}
                          {purchase.splits.length}{" "}
                          {purchase.splits.length === 1 ? "pessoa" : "pessoas"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <strong className="mr-2 text-white">
                          {formatCents(centsOrZero(purchase.amount))}
                        </strong>
                        <button
                          aria-label={`Editar ${purchase.description}`}
                          className="rounded-lg p-2 text-slate-300 hover:bg-white/10"
                          onClick={() => {
                            setEditing(purchase);
                            setModalOpen(true);
                          }}
                          type="button"
                        >
                          <Icon className="size-4" name="edit" />
                        </button>
                        <button
                          aria-label={`Excluir ${purchase.description}`}
                          className="rounded-lg p-2 text-red-300 hover:bg-red-400/10"
                          onClick={() => setConfirming(purchase)}
                          type="button"
                        >
                          <Icon className="size-4" name="trash" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {purchase.splits.map((split) => (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-xs text-slate-300"
                          key={split.id ?? split.participantId ?? "owner"}
                        >
                          {split.participantId === null
                            ? ownerName
                            : (people.get(split.participantId) ??
                              "Participante arquivado")}
                          : {formatCents(centsOrZero(split.amount))}
                          <button
                            aria-label={`${split.paidAt ? "Desfazer pagamento de" : "Marcar como paga"} ${split.participantId === null ? ownerName : (people.get(split.participantId) ?? "participante")}`}
                            className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${split.paidAt ? "bg-emerald-400/15 text-emerald-300 hover:bg-red-400/15 hover:text-red-200" : "bg-amber-400/10 text-amber-200 hover:bg-emerald-400/15 hover:text-emerald-300"}`}
                            onClick={() => {
                              if (split.participantId === null) {
                                setSettling(split);
                                setIncludeExpense(false);
                                setExpenseCategory("");
                              } else updateSplitPayment(split, !split.paidAt);
                            }}
                            type="button"
                          >
                            {split.paidAt ? "Pago" : "Marcar pago"}
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 p-10 text-center">
                <p className="text-sm text-slate-400">
                  Nenhuma compra nesta fatura.
                </p>
                <button
                  className="mt-4 rounded-xl bg-white/10 px-4 py-2.5 text-sm text-white"
                  onClick={() => {
                    setEditing(null);
                    setModalOpen(true);
                  }}
                  type="button"
                >
                  Adicionar primeira compra
                </button>
              </div>
            )}
          </section>
          <p className="text-xs text-slate-500">
            O mês da fatura é definido manualmente por compra. Fechamento e
            transferência para o próximo mês serão adicionados em uma próxima
            etapa.
          </p>
        </>
      )}
      {modalOpen && selectedCard ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div
            aria-labelledby="purchase-dialog-title"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-[#1d2026] p-6 shadow-2xl"
            role="dialog"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2
                className="text-xl font-semibold text-white"
                id="purchase-dialog-title"
              >
                {editing ? "Detalhes da compra" : "Adicionar compra"}
              </h2>
              <button
                aria-label="Fechar"
                className="text-slate-400 hover:text-white"
                onClick={closeModal}
                type="button"
              >
                <Icon className="size-5" name="close" />
              </button>
            </div>
            <PurchaseForm
              key={editing?.id ?? "new"}
              cardId={selectedCard.id}
              month={month}
              ownerName={ownerName}
              participants={participants}
              purchase={editing ?? undefined}
              onClose={closeModal}
            />
          </div>
        </div>
      ) : null}
      {settling ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div
            aria-labelledby="owner-payment-title"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1d2026] p-6"
            role="dialog"
          >
            <h2
              className="text-xl font-semibold text-white"
              id="owner-payment-title"
            >
              {settling.paidAt
                ? "Desfazer pagamento?"
                : "Marcar sua parte como paga"}
            </h2>
            {settling.paidAt ? (
              <p className="mt-2 text-sm leading-6 text-slate-400">
                A parcela voltará a ficar em aberto. Se ela gerou uma despesa,
                essa despesa também será removida.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Sua parte é {formatCents(centsOrZero(settling.amount))}.
                  Deseja incluí-la como despesa deste mês?
                </p>
                <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-[#111319] p-3 text-sm text-slate-200">
                  <input
                    checked={includeExpense}
                    className="size-4 accent-emerald-400"
                    onChange={(event) =>
                      setIncludeExpense(event.target.checked)
                    }
                    type="checkbox"
                  />
                  Criar despesa vinculada à compra
                </label>
                {includeExpense ? (
                  <div className="mt-4 space-y-2">
                    <span
                      className="block text-sm text-slate-200"
                      id="payment-category-label"
                    >
                      Categoria da despesa
                    </span>
                    <DarkSelect
                      ariaLabelledBy="payment-category-label"
                      name="payment-category"
                      onChange={setExpenseCategory}
                      options={categories.map((category) => ({
                        value: category.name,
                        label: category.name,
                      }))}
                      renderOptionPrefix={(option) => (
                        <ExpenseCategoryIcon
                          compact
                          iconKey={
                            categories.find(
                              (category) => category.name === option.value,
                            )?.iconKey
                          }
                          name={option.label}
                        />
                      )}
                      placeholder={
                        categories.length
                          ? "Selecione uma categoria"
                          : "Nenhuma categoria disponível"
                      }
                      value={expenseCategory}
                    />
                    {!categories.length ? (
                      <p className="text-xs text-amber-200">
                        Cadastre uma categoria de despesa antes de criar a
                        despesa vinculada.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-xl bg-white/10 px-4 py-2.5 text-sm text-white"
                disabled={busy}
                onClick={() => setSettling(null)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="rounded-xl bg-[#00e599] px-4 py-2.5 text-sm font-semibold text-[#003822] disabled:opacity-50"
                disabled={
                  busy ||
                  (!settling.paidAt && includeExpense && !expenseCategory)
                }
                onClick={() =>
                  updateSplitPayment(
                    settling,
                    !settling.paidAt,
                    !settling.paidAt && includeExpense
                      ? expenseCategory
                      : undefined,
                  )
                }
                type="button"
              >
                {busy
                  ? "Salvando…"
                  : settling.paidAt
                    ? "Marcar em aberto"
                    : "Confirmar pagamento"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div
            aria-labelledby="delete-purchase-title"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1d2026] p-6"
            role="dialog"
          >
            <h2
              className="text-xl font-semibold text-white"
              id="delete-purchase-title"
            >
              Excluir compra?
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              “{confirming.description}” e seus rateios serão removidos desta
              fatura. Esta ação não pode ser desfeita.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-xl bg-white/10 px-4 py-2 text-sm text-white"
                disabled={busy}
                onClick={() => setConfirming(null)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="rounded-xl bg-red-400 px-4 py-2 text-sm font-semibold text-[#42151a] disabled:opacity-50"
                disabled={busy}
                onClick={removePurchase}
                type="button"
              >
                {busy ? "Excluindo…" : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
