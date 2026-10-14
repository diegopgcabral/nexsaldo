import Link from "next/link";

import { Icon } from "@/components/financial/icons";
import {
  getBankAppearance,
  type CreditCardListItem,
} from "@/lib/financial/credit-card";
import {
  summarizeInvoice,
  type PurchaseListItem,
} from "@/lib/financial/credit-card-invoice";
import { formatCents } from "@/lib/financial/income";
import { addMonths, formatMonthReference } from "@/lib/financial/month";
import type { ParticipantListItem } from "@/lib/financial/participant";

const tones: Record<string, string> = {
  violet: "from-[#7020a7] to-[#32104b] border-violet-400/30",
  orange: "from-[#593113] to-[#1e1b1a] border-orange-400/30",
  slate: "from-[#353941] to-[#121418] border-slate-300/20",
  blue: "from-[#1a3c61] to-[#111923] border-sky-400/25",
  red: "from-[#572229] to-[#19191d] border-red-400/25",
  gold: "from-[#453b21] to-[#17191c] border-amber-400/25",
  marketYellow: "from-[#fff36a] to-[#e5bf00] border-yellow-300/60",
  emerald: "from-[#21443a] to-[#151d1b] border-emerald-400/25",
};

export function InvoiceOverview({
  cards,
  participants,
  purchases,
  ownerName,
  month,
  loadError,
}: {
  cards: CreditCardListItem[];
  participants: ParticipantListItem[];
  purchases: PurchaseListItem[];
  ownerName: string;
  month: string;
  loadError: boolean;
}) {
  const summary = summarizeInvoice(purchases);
  const names = new Map(participants.map((person) => [person.id, person.name]));
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const people = Array.from(summary.personCardTotals.entries())
    .map(([id, byCard]) => ({
      id,
      name:
        id === "owner"
          ? ownerName
          : (names.get(id) ?? "Participante arquivado"),
      byCard,
      paidByCard: summary.personCardPaidTotals.get(id) ?? new Map(),
      total: Array.from(byCard.values()).reduce(
        (sum, amount) => sum + amount,
        0n,
      ),
      paid: Array.from(
        (summary.personCardPaidTotals.get(id) ?? new Map()).values(),
      ).reduce((sum, amount) => sum + amount, 0n),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return (
    <div className="space-y-7">
      <header>
        <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-emerald-400 uppercase">
          Cartões de crédito / Faturas
        </p>
        <h1 className="text-3xl font-bold text-white">Faturas do mês</h1>
        <p className="mt-2 text-sm text-slate-400">
          Escolha um cartão para abrir sua fatura, cadastrar compras e editar os
          rateios.
        </p>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2 text-sm">
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
          <span className="rounded-lg bg-emerald-400/10 px-3 py-2 text-emerald-300">
            Faturas
          </span>
        </div>
        <div
          aria-label="Mês da fatura"
          className="flex min-w-56 items-center justify-between rounded-xl border border-white/10 bg-[#1d2026] px-2 py-1.5 text-sm text-white"
        >
          <Link
            aria-label="Mês anterior"
            className="rounded-lg p-2 hover:bg-white/10"
            href={`/invoices?month=${addMonths(month, -1)}`}
          >
            <Icon className="size-4" name="chevronLeft" />
          </Link>
          <span>{formatMonthReference(month)}</span>
          <Link
            aria-label="Próximo mês"
            className="rounded-lg p-2 hover:bg-white/10"
            href={`/invoices?month=${addMonths(month, 1)}`}
          >
            <Icon className="size-4" name="chevronRight" />
          </Link>
        </div>
      </div>
      {loadError ? (
        <p
          className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200"
          role="alert"
        >
          Não foi possível carregar as faturas. Tente atualizar a página.
        </p>
      ) : null}
      {cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-[#1d2026] p-10 text-center">
          <h2 className="font-semibold text-white">
            Cadastre um cartão primeiro
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            As faturas serão organizadas por cartão.
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
          <section className="rounded-2xl border border-white/5 bg-[#1d2026] p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                Escolha o cartão
              </h2>
              <p className="text-xs text-slate-400">
                Total de todos os cartões:{" "}
                <strong className="text-white">
                  {formatCents(summary.total)}
                </strong>
              </p>
            </div>
            <div
              aria-label="Cartões cadastrados"
              className="-mx-1 mt-3 flex gap-3 overflow-x-auto px-1 pt-2 pb-2"
            >
              {cards.map((card) => {
                const bank = getBankAppearance(card.bankName);
                const light = bank.tone === "marketYellow";
                return (
                  <Link
                    aria-label={`Abrir fatura de ${card.name}, ${formatCents(summary.cardTotals.get(card.id) ?? 0n)}`}
                    className={`flex h-36 w-52 shrink-0 flex-col justify-between rounded-xl border bg-gradient-to-br p-3 text-left shadow-lg transition hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-emerald-400 ${tones[bank.tone] ?? tones.emerald} ${light ? "text-[#161b24]" : "text-white"}`}
                    href={`/invoices/${card.id}?month=${month}`}
                    key={card.id}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="truncate text-xs font-semibold">
                        {card.bankName}
                      </span>
                      <span className="rounded bg-black/15 px-1.5 py-0.5 text-[10px] font-bold">
                        {bank.monogram}
                      </span>
                    </span>
                    <span>
                      {card.name !== card.bankName ? (
                        <span className="block truncate text-sm font-bold">
                          {card.name}
                        </span>
                      ) : null}
                      <span className="mt-1 block text-lg font-bold">
                        {formatCents(summary.cardTotals.get(card.id) ?? 0n)}
                      </span>
                      <span
                        className={`block text-[10px] ${light ? "text-[#161b24]/70" : "text-white/65"}`}
                      >
                        {card.dueDay
                          ? `Vence dia ${card.dueDay}`
                          : "Vencimento não informado"}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
          <section className="rounded-2xl border border-white/5 bg-[#1d2026] p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-white">
                Resumo por participante
              </h2>
              <span className="text-xs text-slate-400">
                {formatMonthReference(month)}
              </span>
            </div>
            {people.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {people.map((person) => (
                  <div
                    className="rounded-xl border border-white/5 bg-[#111319] p-4"
                    key={person.id}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300">
                        <Icon className="size-4" name="person" />
                      </span>
                      <h3 className="truncate font-semibold text-white">
                        {person.name}
                      </h3>
                    </div>
                    <div className="mt-4 space-y-2">
                      {Array.from(person.byCard.entries()).map(
                        ([cardId, amount]) => {
                          const paid = person.paidByCard.get(cardId) ?? 0n;
                          const outstanding = amount - paid;
                          return (
                            <div className="space-y-1 text-sm" key={cardId}>
                              <div className="flex justify-between gap-3">
                                <span className="truncate text-slate-400">
                                  {cardsById.get(cardId)?.name ??
                                    "Cartão removido"}
                                </span>
                                <span className="shrink-0 text-slate-200">
                                  {formatCents(amount)}
                                </span>
                              </div>
                              {paid > 0n ? (
                                <div className="flex justify-between gap-3 text-xs">
                                  <span className="text-slate-500">
                                    (-) Pago
                                  </span>
                                  <span className="text-emerald-300">
                                    {formatCents(paid)}
                                  </span>
                                </div>
                              ) : null}
                              <div className="flex justify-between gap-3 text-xs">
                                <span className="text-slate-500">
                                  Em aberto
                                </span>
                                <span className="text-amber-200">
                                  {formatCents(outstanding)}
                                </span>
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                    <div className="mt-3 space-y-1 border-t border-white/10 pt-3 text-sm font-semibold">
                      <div className="flex justify-between">
                        <span className="text-slate-300">Total do mês</span>
                        <span className="text-emerald-300">
                          {formatCents(person.total)}
                        </span>
                      </div>
                      {person.paid > 0n ? (
                        <div className="flex justify-between text-xs font-normal">
                          <span className="text-slate-500">(-) Pago</span>
                          <span className="text-emerald-300">
                            {formatCents(person.paid)}
                          </span>
                        </div>
                      ) : null}
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Em aberto</span>
                        <span className="text-amber-200">
                          {formatCents(person.total - person.paid)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
                Nenhuma compra neste mês. Abra um cartão para cadastrar a
                primeira.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
