"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { settleParticipantBalance } from "@/app/(financial)/reconciliation/actions";
import { CycleMonthNavigator } from "@/components/financial/cycle-month-navigator";
import { Icon } from "@/components/financial/icons";
import { useToast } from "@/components/financial/toast-provider";
import { getBankAppearance, type CreditCardListItem } from "@/lib/financial/credit-card";
import type { PurchaseListItem } from "@/lib/financial/credit-card-invoice";
import { invoiceAmountToCents } from "@/lib/financial/credit-card-invoice";
import { formatCents } from "@/lib/financial/income";
import type { ParticipantListItem } from "@/lib/financial/participant";

type Receipt = {
  id: string;
  cardId: string;
  participantId: string | null;
  amount: string;
  receivedOn: string;
  notes: string | null;
};

export function ReconciliationManager({
  cards,
  purchases,
  participants,
  receipts,
  ownerName,
  month,
}: {
  cards: CreditCardListItem[];
  purchases: PurchaseListItem[];
  participants: ParticipantListItem[];
  receipts: Receipt[];
  ownerName: string;
  month: string;
}) {
  const { notify } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const names = new Map(participants.map((person) => [person.id, person.name]));
  const byCard = new Map<string, Map<string, { due: bigint; legacy: bigint; received: bigint }>>();
  const totals = new Map<string, bigint>();
  for (const purchase of purchases) {
    const cardTotal = totals.get(purchase.cardId) ?? 0n;
    totals.set(purchase.cardId, cardTotal + invoiceAmountToCents(purchase.amount));
    const people = byCard.get(purchase.cardId) ?? new Map();
    for (const split of purchase.splits) {
      const id = split.participantId ?? "owner";
      const current = people.get(id) ?? { due: 0n, legacy: 0n, received: 0n };
      const value = invoiceAmountToCents(split.amount);
      current.due += value;
      if (split.paidAt) current.legacy += value;
      people.set(id, current);
    }
    byCard.set(purchase.cardId, people);
  }
  for (const receipt of receipts) {
    const person = receipt.participantId ? byCard.get(receipt.cardId)?.get(receipt.participantId) : undefined;
    if (person) person.received += invoiceAmountToCents(receipt.amount);
  }
  const cardRows = cards.map((card) => {
    const people = byCard.get(card.id) ?? new Map();
    const total = totals.get(card.id) ?? 0n;
    let coverage = 0n;
    const rows = Array.from(people.entries()).map(([id, values]) => {
      const received = id === "owner" ? values.legacy : values.legacy + values.received;
      const capped = received > values.due ? values.due : received;
      coverage += capped;
      return { id, ...values, received: capped, open: values.due - capped };
    });
    const missing = total > coverage ? total - coverage : 0n;
    const status = coverage === 0n ? "Pendente" : missing > 0n ? "Parcial" : "Coberta";
    return { card, total, rows, coverage, missing, status };
  });
  const totalInvoices = cardRows.reduce((sum, item) => sum + item.total, 0n);
  const totalPaid = cardRows.reduce((sum, item) => sum + item.coverage, 0n);
  const outstanding = cardRows.reduce((sum, item) => sum + item.missing, 0n);
  const participantTotals = new Map<string, { due: bigint; received: bigint; open: bigint }>();
  for (const { rows } of cardRows) for (const row of rows) {
    const current = participantTotals.get(row.id) ?? { due: 0n, received: 0n, open: 0n };
    current.due += row.due;
    current.received += row.received;
    current.open += row.open;
    participantTotals.set(row.id, current);
  }
  const people = Array.from(participantTotals.entries()).map(([id, values]) => ({
    id,
    name: id === "owner" ? `${ownerName} (titular)` : (names.get(id) ?? "Participante arquivado"),
    ...values,
  })).sort((first, second) => first.name.localeCompare(second.name, "pt-BR"));
  const ownerPayments = purchases.flatMap((purchase) => purchase.splits.flatMap((split) => split.participantId === null && split.paidAt ? [{
    id: `owner-${split.id}`,
    cardId: purchase.cardId,
    participantId: null,
    amount: split.amount,
    receivedOn: split.paidAt.slice(0, 10),
    notes: null,
  }] : []));
  const paymentHistory = [...receipts, ...ownerPayments].sort((first, second) => second.receivedOn.localeCompare(first.receivedOn));

  function settle(id: string) {
    startTransition(async () => {
      const result = await settleParticipantBalance({ participantId: id, month });
      if (result.error) notify("error", result.error);
      else {
        notify("success", "Pagamento registrado em todas as faturas abertas.");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-emerald-400 uppercase">Cartões de crédito / Conciliação</p>
          <h1 className="mt-1 text-3xl font-bold text-white">Conciliação de faturas</h1>
          <p className="mt-2 text-sm text-slate-400">Acompanhe a cobertura das faturas fechadas e os valores ainda a receber.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CycleMonthNavigator month={month} pathname="/reconciliation" />
          <span className="rounded-xl bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-300">{cards.length} fatura{cards.length === 1 ? "" : "s"} fechada{cards.length === 1 ? "" : "s"}</span>
        </div>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Total das faturas fechadas" value={totalInvoices} tone="text-white" />
        <Metric label="Total já pago" value={totalPaid} tone="text-emerald-300" />
        <Metric label="Falta pagar" value={outstanding} tone={outstanding ? "text-amber-200" : "text-emerald-300"} />
      </div>
      <section>
        <div className="mb-3"><h2 className="font-semibold text-white">Pagamentos por participante</h2><p className="mt-1 text-sm text-slate-400">Cada pagamento quita a parte da pessoa em todas as faturas fechadas deste mês.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {people.map((person) => {
            const status = person.open === 0n ? "Pago" : person.received === 0n ? "Pendente" : "Parcial";
            const statusClass = status === "Pago" ? "bg-emerald-400/10 text-emerald-300" : status === "Parcial" ? "bg-amber-400/10 text-amber-200" : "bg-red-400/10 text-red-200";
            return <article className="rounded-2xl border border-white/5 bg-[#191c21] p-4" key={person.id}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-white">{person.name}</p><p className="mt-1 text-xs text-slate-500">Total em {cards.length} fatura{cards.length === 1 ? "" : "s"} fechada{cards.length === 1 ? "" : "s"}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}>{status}</span></div><div className="mt-4 flex items-end justify-between gap-3"><div><p className="text-xs text-slate-500">Em aberto</p><p className="mt-1 text-xl font-bold text-white">{formatCents(person.open)}</p>{person.received > 0n ? <p className="mt-1 text-xs text-emerald-300">{formatCents(person.received)} já pago</p> : null}</div>{person.open > 0n ? <button className="rounded-xl bg-emerald-400 px-3 py-2 text-xs font-semibold text-[#003822] disabled:opacity-50" disabled={pending} onClick={() => settle(person.id)} type="button">Registrar pagamento</button> : null}</div></article>;
          })}
        </div>
      </section>
      <section className="space-y-3">
        {cardRows.map(({ card, total, rows, coverage, missing, status }) => (
          <details className="group overflow-hidden rounded-2xl border border-white/5 bg-[#191c21]" key={card.id}>
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4 p-4 [&::-webkit-details-marker]:hidden">
              <div className="flex min-w-0 items-center gap-3"><CardThumbnail bankName={card.bankName} /><div className="min-w-0"><p className="truncate font-semibold text-white">{card.name}</p><p className="truncate text-xs text-slate-500">{card.bankName} · Fatura fechada</p></div></div>
              <div className="grid grid-cols-[repeat(3,76px)_88px_16px] items-center gap-x-3 text-right text-xs">
                <Value label="Fatura" value={total} />
                <Value label="Cobertura" value={coverage} tone="text-emerald-300" />
                <Value label="Falta" value={missing} tone={missing ? "text-amber-200" : "text-emerald-300"} />
                <span className={`inline-flex w-[88px] justify-center rounded-full px-2.5 py-1 font-semibold ${status === "Coberta" ? "bg-emerald-400/10 text-emerald-300" : status === "Parcial" ? "bg-amber-400/10 text-amber-200" : "bg-red-400/10 text-red-200"}`}>{status}</span>
                <Icon className="size-4 text-slate-400 transition group-open:rotate-180" name="chevronDown" />
              </div>
            </summary>
            <div className="border-t border-white/5 p-4">
              <div className="overflow-x-auto"><table className="w-full min-w-130 text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="pb-3">Participante</th><th className="pb-3 text-right">Devido</th><th className="pb-3 text-right">Pago</th><th className="pb-3 text-right">Em aberto</th></tr></thead><tbody>{rows.map((row) => <tr className="border-t border-white/5" key={row.id}><td className="py-3 font-medium text-white">{row.id === "owner" ? `${ownerName} (titular)` : (names.get(row.id) ?? "Participante arquivado")}</td><td className="py-3 text-right text-slate-300">{formatCents(row.due)}</td><td className="py-3 text-right text-emerald-300">{formatCents(row.received)}</td><td className="py-3 text-right text-amber-200">{formatCents(row.open)}</td></tr>)}</tbody></table></div>
            </div>
          </details>
        ))}
        {!cardRows.length ? <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-400">Nenhuma fatura fechada neste mês.</div> : null}
      </section>
      {paymentHistory.length ? <details className="rounded-2xl border border-white/5 bg-[#191c21] p-4"><summary className="cursor-pointer text-sm font-semibold text-white">Histórico de pagamentos ({paymentHistory.length})</summary><div className="mt-4 overflow-x-auto"><table className="w-full min-w-150 text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="pb-2">Data</th><th className="pb-2">Participante</th><th className="pb-2">Cartão</th><th className="pb-2 text-right">Valor</th></tr></thead><tbody>{paymentHistory.map((receipt) => <tr className="border-t border-white/5" key={receipt.id}><td className="py-2.5 text-slate-400">{new Intl.DateTimeFormat("pt-BR").format(new Date(`${receipt.receivedOn}T12:00:00`))}</td><td className="py-2.5 text-white">{receipt.participantId === null ? `${ownerName} (titular)` : (names.get(receipt.participantId) ?? "Participante")}</td><td className="py-2.5 text-slate-400">{cards.find((card) => card.id === receipt.cardId)?.name ?? "Cartão"}</td><td className="py-2.5 text-right font-semibold text-emerald-300">{formatCents(invoiceAmountToCents(receipt.amount))}</td></tr>)}</tbody></table></div></details> : null}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: bigint; tone: string }) { return <div className="rounded-2xl bg-[#191c21] p-5"><p className="text-sm text-slate-400">{label}</p><p className={`mt-2 text-2xl font-bold ${tone}`}>{formatCents(value)}</p></div>; }
function Value({ label, value, tone = "text-white" }: { label: string; value: bigint; tone?: string }) { return <span><span className="block text-slate-500">{label}</span><strong className={tone}>{formatCents(value)}</strong></span>; }

const cardThumbnailTones: Record<string, string> = {
  violet: "border-violet-400/30 from-[#7020a7] via-[#49156f] to-[#251136] text-white",
  orange: "border-orange-400/30 from-[#593113] via-[#382516] to-[#1e1b1a] text-white",
  slate: "border-slate-300/20 from-[#31353d] via-[#22252b] to-[#121418] text-white",
  blue: "border-sky-400/25 from-[#1a3c61] via-[#172b45] to-[#111923] text-white",
  red: "border-red-400/25 from-[#572229] via-[#351d25] to-[#19191d] text-white",
  gold: "border-amber-400/25 from-[#453b21] via-[#2c2b21] to-[#17191c] text-white",
  marketYellow: "border-[#ffe600] from-[#fff36a] via-[#ffe600] to-[#e5bf00] text-[#161b24]",
  emerald: "border-emerald-400/25 from-[#21443a] via-[#1b312c] to-[#151d1b] text-white",
};

function CardThumbnail({ bankName }: { bankName: string }) {
  const bank = getBankAppearance(bankName);
  const light = bank.tone === "marketYellow";
  return <span aria-hidden="true" className={`relative flex h-10 w-16 shrink-0 flex-col justify-between overflow-hidden rounded-lg border bg-gradient-to-br p-1.5 shadow-md ${cardThumbnailTones[bank.tone] ?? cardThumbnailTones.emerald}`}><span className="text-[9px] leading-none font-bold">{bank.monogram}</span><span className={`h-2.5 w-3.5 self-end rounded-[2px] border ${light ? "border-[#161b24]/30 bg-[#161b24]/15" : "border-amber-200/30 bg-amber-200/45"}`} /></span>;
}
