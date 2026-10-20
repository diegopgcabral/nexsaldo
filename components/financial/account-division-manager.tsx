"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import {
  addManualCharge,
  confirmVisualStatementPayment,
  deleteStatementEntry,
  finalizeStatement,
  reopenStatement,
  undoVisualStatementPayment,
  updateManualCharge,
} from "@/app/(financial)/account-division/actions";
import { Icon } from "@/components/financial/icons";
import {
  centsToCurrency,
  summarizeStatement,
  type StatementManualCharge,
  type StatementPurchase,
} from "@/lib/financial/account-division";
import { getBankAppearance } from "@/lib/financial/credit-card";
import type { ParticipantListItem } from "@/lib/financial/participant";

export type ParticipantStatementSummary = {
  participant: ParticipantListItem;
  cardsCents: bigint;
  manualCents: bigint;
  isPaymentConfirmed: boolean;
  isFinalized: boolean;
};

export function AccountDivisionManager({
  month,
  summaries,
}: {
  month: string;
  summaries: ParticipantStatementSummary[];
}) {
  const [, startTransition] = useTransition();
  const [confirmingParticipantId, setConfirmingParticipantId] = useState<
    string | null
  >(null);
  const [showFinalized, setShowFinalized] = useState(false);
  const finalizedCount = summaries.filter(
    (summary) => summary.isFinalized,
  ).length;
  const visibleSummaries = summaries.filter(
    (summary) => summary.isFinalized === showFinalized,
  );
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-emerald-400 uppercase">
            Pessoas / Divisão de contas
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Divisão de contas
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {showFinalized
              ? "Demonstrativos finalizados nesta competência."
              : "Escolha uma pessoa para conferir as compras do mês e gerar seu demonstrativo."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowFinalized((current) => !current)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/5"
        >
          <Icon name="check" className="size-4 text-emerald-300" />
          {showFinalized
            ? "Ver divisões em aberto"
            : `Divisões finalizadas${finalizedCount ? ` (${finalizedCount})` : ""}`}
        </button>
      </header>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visibleSummaries.map(
          ({
            participant,
            cardsCents,
            manualCents,
            isPaymentConfirmed,
            isFinalized,
          }) => {
            const total = cardsCents + manualCents;
            return (
              <article
                key={participant.id}
                className="rounded-2xl border border-white/5 bg-[#1d2026] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#30343b] text-sm font-bold text-emerald-300">
                      {participant.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold text-white">
                        {participant.name}
                      </h2>
                      <p className="truncate text-xs text-slate-500">
                        {participant.phone || "Celular não cadastrado"}
                      </p>
                    </div>
                  </div>
                  {isPaymentConfirmed ? (
                    <button
                      type="button"
                      onClick={() => {
                        startTransition(async () => {
                          await undoVisualStatementPayment({
                            participantId: participant.id,
                            month,
                          });
                        });
                      }}
                      className="rounded-full bg-emerald-400/15 px-2 py-1 text-[10px] font-bold text-emerald-300 hover:bg-emerald-400/25"
                      title="Desfazer confirmação de pagamento"
                    >
                      PAGO
                    </button>
                  ) : (
                    <span className="rounded-full bg-slate-400/10 px-2 py-1 text-[10px] font-bold text-slate-400">
                      {isFinalized ? "FINALIZADA" : "PENDENTE"}
                    </span>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-[#111319] p-3 text-xs">
                  <div>
                    <p className="text-slate-500">Cartões</p>
                    <p className="mt-1 font-semibold text-slate-100">
                      {centsToCurrency(cardsCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Outras contas</p>
                    <p className="mt-1 font-semibold text-slate-100">
                      {centsToCurrency(manualCents)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-slate-500">Total do mês</p>
                    <p className="font-bold text-emerald-300">
                      {centsToCurrency(total)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isFinalized ? (
                      <button
                        type="button"
                        onClick={() => {
                          startTransition(async () => {
                            await reopenStatement({
                              participantId: participant.id,
                              month,
                            });
                          });
                        }}
                        className="rounded-lg border border-amber-300/40 px-2.5 py-2 text-xs font-bold text-amber-200 hover:bg-amber-300/10"
                      >
                        Reabrir
                      </button>
                    ) : !isPaymentConfirmed ? (
                      <button
                        disabled={confirmingParticipantId === participant.id}
                        onClick={() => {
                          setConfirmingParticipantId(participant.id);
                          startTransition(async () => {
                            try {
                              await confirmVisualStatementPayment({
                                participantId: participant.id,
                                month,
                              });
                            } finally {
                              setConfirmingParticipantId(null);
                            }
                          });
                        }}
                        className="rounded-lg border border-emerald-400/40 px-2.5 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-400/10 disabled:cursor-wait disabled:opacity-60"
                      >
                        {confirmingParticipantId === participant.id
                          ? "Confirmando…"
                          : "Confirmar pagamento"}
                      </button>
                    ) : null}
                    <Link
                      href={`/account-division/${participant.id}?month=${month}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-400 px-3 py-2 text-sm font-bold text-[#003822]"
                    >
                      <Icon name="receipt" className="size-4" /> Detalhes
                    </Link>
                  </div>
                </div>
              </article>
            );
          },
        )}
      </section>
      {visibleSummaries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
          {showFinalized
            ? "Nenhuma divisão foi finalizada nesta competência."
            : "Cadastre um participante para montar os demonstrativos."}
        </p>
      ) : null}
    </div>
  );
}

export function AccountDivisionDetail({
  month,
  participant,
  purchases,
  manualCharges,
  isFinalized,
}: {
  month: string;
  participant: ParticipantListItem;
  purchases: StatementPurchase[];
  manualCharges: StatementManualCharge[];
  isFinalized: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [showCharge, setShowCharge] = useState(false);
  const [editingCharge, setEditingCharge] =
    useState<StatementManualCharge | null>(null);
  const [askToSend, setAskToSend] = useState(false);
  const summary = summarizeStatement(purchases, manualCharges, []);
  const whatsapp = participant.phone
    ? `https://wa.me/${participant.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá, ${participant.name}! Segue o demonstrativo das suas contas de ${formatStatementMonth(month)}. Total: ${centsToCurrency(summary.totalDueCents)}.`)}`
    : null;
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href={`/account-division?month=${month}`}
            className="text-xs text-emerald-300 hover:underline"
          >
            ← Divisão de contas
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
            {participant.name}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Demonstrativo de {formatStatementMonth(month)}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isFinalized ? (
            <button
              type="button"
              onClick={() => {
                startTransition(async () => {
                  await reopenStatement({
                    participantId: participant.id,
                    month,
                  });
                });
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-300/40 px-4 py-2.5 text-sm font-semibold text-amber-200 hover:bg-amber-300/10"
            >
              <Icon name="edit" className="size-4" /> Reabrir divisão
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                startTransition(async () => {
                  await finalizeStatement({
                    participantId: participant.id,
                    month,
                  });
                });
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/5"
            >
              <Icon name="check" className="size-4 text-emerald-300" />
              Finalizar divisão
            </button>
          )}
          <button
            onClick={() => {
              const printWindow = window.open(
                `/account-division-print/${participant.id}?month=${month}`,
                "_blank",
              );
              if (!printWindow) {
                setAskToSend(true);
                return;
              }
              const watcher = window.setInterval(() => {
                if (!printWindow.closed) return;
                window.clearInterval(watcher);
                setAskToSend(true);
              }, 500);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-[#003822] hover:bg-emerald-300"
          >
            <PrintIcon />
            Gerar demonstrativo
          </button>
          {whatsapp ? (
            <button
              type="button"
              onClick={() => openWhatsApp(whatsapp)}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 px-4 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-400/10"
            >
              <WhatsAppIcon />
              Enviar pelo WhatsApp
            </button>
          ) : (
            <Link
              href="/participants"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/5"
            >
              <WhatsAppIcon />
              Cadastrar WhatsApp
            </Link>
          )}
        </div>
      </header>
      <section className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5">
        <p className="text-xs font-bold tracking-wider text-emerald-300 uppercase">
          Total para informar
        </p>
        <p className="mt-1 text-3xl font-bold text-white">
          {centsToCurrency(summary.totalDueCents)}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Metric label="Compras em cartões" value={summary.cardsTotalCents} />
          <Metric label="Outras contas" value={summary.manualTotalCents} />
        </div>
      </section>
      {isFinalized ? (
        <p className="rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-sm text-amber-100">
          Esta divisão está finalizada. Reabra-a para incluir, editar ou excluir
          outras contas.
        </p>
      ) : null}
      <section className="rounded-2xl border border-white/5 bg-[#191c21] p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          <Icon name="creditCard" className="size-5 text-emerald-300" /> Compras
          em cartões
        </h2>
        <div className="mt-4 space-y-3">
          {summary.cards.length ? (
            summary.cards.map((card) => (
              <div key={card.id} className="rounded-xl bg-[#111319] p-4">
                <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-3">
                  <div className="flex items-center gap-3">
                    <CardThumbnail bank={card.bankName} />
                    <div>
                      <p className="font-semibold text-white">{card.name}</p>
                      <p className="text-xs text-slate-500">{card.bankName}</p>
                    </div>
                  </div>
                  <p className="font-semibold text-white">
                    {centsToCurrency(card.totalCents)}
                  </p>
                </div>
                {card.purchases.map((purchase, index) => (
                  <div
                    key={`${purchase.description}-${index}`}
                    className="grid grid-cols-[1fr_auto] gap-3 border-b border-white/5 py-3 text-sm last:border-0"
                  >
                    <div>
                      <p className="text-slate-200">{purchase.description}</p>
                      <p className="text-xs text-slate-500">
                        {purchase.installmentCount > 1
                          ? `${purchase.installmentNumber}/${purchase.installmentCount} · `
                          : ""}
                        {formatDate(purchase.purchasedOn)}
                      </p>
                    </div>
                    <p className="text-slate-100">
                      {currency(purchase.amount)}
                    </p>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <Empty text="Nenhuma compra em cartão foi atribuída a esta pessoa neste mês." />
          )}
        </div>
      </section>
      <section className="rounded-2xl border border-white/5 bg-[#191c21] p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-white">Outras contas</h2>
          {!isFinalized ? (
            <button
              onClick={() => {
                setEditingCharge(null);
                setShowCharge(true);
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-3 py-2 text-sm font-semibold text-emerald-300 hover:bg-white/10"
            >
              <Icon name="plus" className="size-4" /> Adicionar
            </button>
          ) : null}
        </div>
        <div className="mt-3 divide-y divide-white/5">
          {manualCharges.length ? (
            manualCharges.map((charge) => (
              <div
                key={charge.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm text-slate-200">{charge.description}</p>
                  <p className="text-xs text-slate-500">
                    {charge.installmentCount > 1
                      ? `Parcela ${charge.installmentNumber}/${charge.installmentCount} · `
                      : ""}
                    {charge.dueOn
                      ? `Competência ${formatStatementMonth(charge.dueOn.slice(0, 7))}`
                      : charge.notes || "Conta adicional"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm text-white">
                    {currency(charge.amount)}
                  </p>
                  {!isFinalized ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCharge(charge);
                          setShowCharge(false);
                        }}
                        aria-label="Atualizar conta"
                        className="flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-emerald-400/10 hover:text-emerald-300"
                        title="Atualizar conta"
                      >
                        <Icon name="edit" className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          startTransition(async () => {
                            await deleteStatementEntry(charge.id);
                          });
                        }}
                        aria-label="Excluir conta"
                        className="flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-red-400/10 hover:text-red-300"
                        title="Excluir conta"
                      >
                        <Icon name="trash" className="size-4" />
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <Empty text="Inclua aqui contas fora dos cartões." />
          )}
        </div>
      </section>
      {showCharge || editingCharge ? (
        <ManualChargeDrawer
          month={month}
          participantId={participant.id}
          charge={editingCharge}
          pending={pending}
          onClose={() => {
            setShowCharge(false);
            setEditingCharge(null);
          }}
          startTransition={startTransition}
        />
      ) : null}
      {askToSend ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1d2026] p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-emerald-400/15 text-xl text-emerald-300">
                <WhatsAppIcon />
              </span>
              <div>
                <h2 className="font-bold text-white">Enviar demonstrativo?</h2>
                <p className="text-sm text-slate-400">
                  {participant.phone || "Telefone não cadastrado"}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Deseja abrir o WhatsApp com a mensagem pronta para{" "}
              {participant.name}?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setAskToSend(false)}
                className="rounded-lg px-4 py-2 text-sm text-slate-300"
              >
                Agora não
              </button>
              {whatsapp ? (
                <button
                  type="button"
                  onClick={() => {
                    setAskToSend(false);
                    openWhatsApp(whatsapp);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-2 text-sm font-bold text-[#003822]"
                >
                  <WhatsAppIcon /> Enviar pelo WhatsApp
                </button>
              ) : (
                <Link
                  href="/participants"
                  className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-bold text-[#342400]"
                >
                  Cadastrar telefone
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
function CardThumbnail({ bank }: { bank: string }) {
  const appearance = getBankAppearance(bank);
  const light = appearance.tone === "marketYellow";
  return (
    <div
      className={`flex h-10 w-16 flex-col justify-between rounded-md border bg-gradient-to-br p-1.5 text-[8px] shadow-lg ${cardTones[appearance.tone] ?? cardTones.emerald}`}
    >
      <span className="font-bold">{appearance.monogram}</span>
      <span
        className={`h-2.5 w-3.5 self-end rounded-[2px] border ${light ? "border-[#161b24]/30 bg-[#161b24]/15" : "border-amber-200/30 bg-amber-200/45"}`}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: bigint }) {
  return (
    <div className="rounded-xl bg-[#111319] p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-white">
        {centsToCurrency(value)}
      </p>
    </div>
  );
}

const cardTones: Record<string, string> = {
  violet:
    "border-violet-400/30 from-[#7020a7] via-[#49156f] to-[#251136] text-white",
  orange:
    "border-orange-400/30 from-[#593113] via-[#382516] to-[#1e1b1a] text-white",
  slate:
    "border-slate-300/20 from-[#31353d] via-[#22252b] to-[#121418] text-white",
  blue: "border-sky-400/25 from-[#1a3c61] via-[#172b45] to-[#111923] text-white",
  red: "border-red-400/25 from-[#572229] via-[#351d25] to-[#19191d] text-white",
  gold: "border-amber-400/25 from-[#453b21] via-[#2c2b21] to-[#17191c] text-white",
  marketYellow:
    "border-[#ffe600] from-[#fff36a] via-[#ffe600] to-[#e5bf00] text-[#161b24]",
  emerald:
    "border-emerald-400/25 from-[#21443a] via-[#1b312c] to-[#151d1b] text-white",
};
function Empty({ text }: { text: string }) {
  return <p className="py-4 text-sm text-slate-500">{text}</p>;
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${value}T12:00:00`));
}

function formatStatementMonth(month: string) {
  const [year, monthNumber] = month.split("-");
  const name = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(
    new Date(Number(year), Number(monthNumber) - 1, 1),
  );
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}/${year}`;
}
function currency(amount: string) {
  return centsToCurrency(BigInt(Math.round(Number(amount) * 100)));
}

function openWhatsApp(url: string) {
  window.open(url, "nexsaldo-whatsapp");
}

function formatCurrencyInput(value: string) {
  const cents = value.replace(/\D/g, "");
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(cents || "0") / 100);
}

function formatStoredCurrency(value: string) {
  return Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function ManualChargeDrawer({
  month,
  participantId,
  charge,
  pending,
  onClose,
  startTransition,
}: {
  month: string;
  participantId: string;
  charge: StatementManualCharge | null;
  pending: boolean;
  onClose: () => void;
  startTransition: ReturnType<typeof useTransition>[1];
}) {
  const editing = charge !== null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
      <button
        type="button"
        aria-label="Fechar painel"
        className="flex-1 cursor-default"
        onClick={onClose}
      />
      <aside className="h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#191c21] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-emerald-300 uppercase">
              Outras contas
            </p>
            <h2 className="mt-2 text-xl font-bold text-white">
              {editing ? "Editar conta" : "Adicionar conta"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {formatStatementMonth(month)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar painel"
            title="Fechar"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <Icon name="close" className="size-5" />
          </button>
        </div>
        <ManualChargeForm
          key={charge?.id ?? "new-charge"}
          month={month}
          participantId={participantId}
          charge={charge}
          pending={pending}
          onCancel={onClose}
          onSaved={onClose}
          startTransition={startTransition}
        />
      </aside>
    </div>
  );
}

function ManualChargeForm({
  month,
  participantId,
  charge,
  pending,
  onCancel,
  onSaved,
  startTransition,
}: {
  month: string;
  participantId: string;
  charge: StatementManualCharge | null;
  pending: boolean;
  onCancel: () => void;
  onSaved: () => void;
  startTransition: ReturnType<typeof useTransition>[1];
}) {
  const [amount, setAmount] = useState(
    charge ? formatStoredCurrency(charge.amount) : "",
  );
  const [installmentCount, setInstallmentCount] = useState(
    charge?.installmentCount ?? 1,
  );
  const [installmentNumber, setInstallmentNumber] = useState(
    charge?.installmentNumber ?? 1,
  );
  const editing = charge !== null;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        startTransition(async () => {
          const input = Object.fromEntries(new FormData(form));
          const result = editing
            ? await updateManualCharge({ ...input, id: charge.id })
            : await addManualCharge(input);
          if (!result?.error) {
            form.reset();
            setAmount("");
            onSaved();
          }
        });
      }}
      className="mt-8 space-y-5"
    >
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="participantId" value={participantId} />
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-slate-200">Descrição</span>
        <input
          required
          name="description"
          placeholder="Ex.: Internet, Farmácia"
          defaultValue={charge?.description}
          className="w-full rounded-lg bg-white/5 px-3 py-2.5 text-sm text-white ring-1 ring-white/5 outline-none focus:ring-emerald-400/60"
        />
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-200">
            Parcela atual
          </span>
          {editing ? (
            <div className="rounded-lg bg-white/5 px-3 py-2.5 text-sm text-slate-300 ring-1 ring-white/5">
              Parcela {charge.installmentNumber}/{charge.installmentCount}
            </div>
          ) : (
            <input
              required
              name="installmentNumber"
              type="number"
              min={1}
              max={installmentCount}
              value={installmentNumber}
              onChange={(event) =>
                setInstallmentNumber(
                  Math.min(
                    installmentCount,
                    Math.max(1, Number(event.target.value) || 1),
                  ),
                )
              }
              className="w-full rounded-lg bg-white/5 px-3 py-2.5 text-sm text-white ring-1 ring-white/5 outline-none focus:ring-emerald-400/60"
            />
          )}
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-200">
            Total de parcelas
          </span>
          {editing ? (
            <div className="rounded-lg bg-white/5 px-3 py-2.5 text-sm text-slate-300 ring-1 ring-white/5">
              {charge.installmentCount} parcelas
            </div>
          ) : (
            <input
              required
              name="installmentCount"
              type="number"
              min={1}
              max={120}
              value={installmentCount}
              onChange={(event) => {
                const nextCount = Math.min(
                  120,
                  Math.max(1, Number(event.target.value) || 1),
                );
                setInstallmentCount(nextCount);
                setInstallmentNumber((current) => Math.min(current, nextCount));
              }}
              className="w-full rounded-lg bg-white/5 px-3 py-2.5 text-sm text-white ring-1 ring-white/5 outline-none focus:ring-emerald-400/60"
            />
          )}
        </label>
      </div>
      <p className="-mt-2 text-xs text-slate-500">
        {editing
          ? "Esta parcela pode ser ajustada sem modificar as demais."
          : installmentCount === 1
            ? "Conta à vista."
            : `Serão criadas as parcelas ${installmentNumber}/${installmentCount} até ${installmentCount}/${installmentCount} nas próximas competências.`}
      </p>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-slate-200">Valor</span>
        <input
          required
          name="amount"
          inputMode="numeric"
          value={amount}
          onChange={(event) =>
            setAmount(formatCurrencyInput(event.target.value))
          }
          placeholder="0,00"
          className="w-full rounded-lg bg-white/5 px-3 py-2.5 text-sm text-white ring-1 ring-white/5 outline-none focus:ring-emerald-400/60"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-slate-200">Competência</span>
        <input
          name="dueMonth"
          type="month"
          defaultValue={charge?.dueOn?.slice(0, 7) ?? month}
          className="w-full rounded-lg bg-white/5 px-3 py-2.5 text-sm text-white ring-1 ring-white/5 outline-none focus:ring-emerald-400/60"
        />
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5"
        >
          Cancelar
        </button>
        <button
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-bold text-[#003822] hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? (
            <span className="animate-pulse">
              {editing ? "Atualizando…" : "Adicionando…"}
            </span>
          ) : (
            <>
              <Icon name="check" className="size-4" />
              {editing ? "Atualizar" : "Adicionar"}
            </>
          )}
        </button>
      </div>
    </form>
  );
}

function PrintIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M6 14h12v7H6zM18 12h.01" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M20.5 3.5A11.9 11.9 0 0 0 12 0C5.4 0 .1 5.3.1 11.9c0 2.1.5 4.1 1.5 5.9L0 24l6.4-1.6a12 12 0 0 0 5.6 1.4h.1c6.6 0 11.9-5.3 11.9-11.9 0-3.2-1.2-6.1-3.5-8.4Zm-8.4 18.3h-.1a9.9 9.9 0 0 1-5.1-1.4l-.4-.2-3.8 1 1-3.7-.2-.4A9.8 9.8 0 0 1 2.2 12c0-5.4 4.4-9.8 9.8-9.8 2.6 0 5.1 1 7 2.9a9.8 9.8 0 0 1-6.9 16.7Z" />
    </svg>
  );
}
