"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  deleteCreditCard,
  saveCreditCard,
  type CreditCardActionState,
} from "@/app/(financial)/cards/actions";
import { DarkSelect } from "@/components/financial/dark-select";
import { Icon } from "@/components/financial/icons";
import { useToast } from "@/components/financial/toast-provider";
import {
  creditCardBanks,
  getBankAppearance,
  type CreditCardListItem,
} from "@/lib/financial/credit-card";

type CreditCardManagerProps = {
  cards: CreditCardListItem[];
  loadError: boolean;
};

const cardTones: Record<string, string> = {
  violet:
    "border-violet-400/30 bg-gradient-to-br from-[#7020a7] via-[#49156f] to-[#251136]",
  orange:
    "border-orange-400/30 bg-gradient-to-br from-[#593113] via-[#382516] to-[#1e1b1a]",
  slate:
    "border-slate-300/20 bg-gradient-to-br from-[#31353d] via-[#22252b] to-[#121418]",
  blue: "border-sky-400/25 bg-gradient-to-br from-[#1a3c61] via-[#172b45] to-[#111923]",
  red: "border-red-400/25 bg-gradient-to-br from-[#572229] via-[#351d25] to-[#19191d]",
  gold: "border-amber-400/25 bg-gradient-to-br from-[#453b21] via-[#2c2b21] to-[#17191c]",
  marketYellow:
    "border-[#ffe600] bg-gradient-to-br from-[#fff36a] via-[#ffe600] to-[#e5bf00]",
  emerald:
    "border-emerald-400/25 bg-gradient-to-br from-[#21443a] via-[#1b312c] to-[#151d1b]",
};

function CreditCardChip({ light = false }: { light?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`relative block h-8 w-11 overflow-hidden rounded-md border shadow-inner ${
        light
          ? "border-slate-600/50 bg-gradient-to-br from-[#f3f4f6] via-[#b8c0c9] to-[#777f8b] text-slate-700"
          : "border-amber-950/40 bg-gradient-to-br from-[#f9e3aa] via-[#d7ad59] to-[#9c6d30] text-amber-950/60"
      }`}
    >
      <svg className="h-full w-full" fill="none" viewBox="0 0 44 32">
        <rect
          height="29"
          rx="3"
          stroke="currentColor"
          width="41"
          x="1.5"
          y="1.5"
        />
        <path
          d="M1.5 10h12l5 5v2l-5 5h-12M42.5 10h-12l-5 5v2l5 5h12M18.5 1.5V10M25.5 1.5V10M18.5 22v8.5M25.5 22v8.5"
          stroke="currentColor"
        />
        <rect
          height="12"
          rx="2"
          stroke="currentColor"
          width="14"
          x="15"
          y="10"
        />
      </svg>
    </span>
  );
}

function CreditCardForm({
  card,
  onClose,
}: {
  card?: CreditCardListItem;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    CreditCardActionState,
    FormData
  >(saveCreditCard, {});
  const presetBank = creditCardBanks.find(
    (bank) => bank.name === card?.bankName,
  );
  const [selectedBank, setSelectedBank] = useState(
    card ? (presetBank?.key ?? "other") : "",
  );
  const router = useRouter();
  const { notify } = useToast();

  useEffect(() => {
    if (state.success) {
      notify("success", card ? "Cartão atualizado." : "Cartão cadastrado.");
      router.refresh();
      onClose();
    }
  }, [card, notify, onClose, router, state.success]);

  return (
    <form action={formAction} className="space-y-5 p-6">
      {card ? <input name="id" type="hidden" value={card.id} /> : null}
      <div className="space-y-2">
        <span
          className="block text-sm font-medium text-slate-200"
          id="card-bank-label"
        >
          Banco emissor
        </span>
        <DarkSelect
          ariaLabelledBy="card-bank-label"
          name="bank"
          onChange={setSelectedBank}
          options={[
            ...creditCardBanks.map((bank) => ({
              value: bank.key,
              label: bank.name,
            })),
            { value: "other", label: "Outra instituição" },
          ]}
          placeholder="Selecione um banco"
          value={selectedBank}
        />
      </div>
      {selectedBank === "other" ? (
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-200">
            Nome da instituição
          </span>
          <input
            autoComplete="off"
            className="w-full rounded-xl border border-white/10 bg-[#111319] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
            defaultValue={card && !presetBank ? card.bankName : ""}
            maxLength={80}
            name="otherBank"
            placeholder="Ex.: Banco local"
            required
          />
        </label>
      ) : null}
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-200">
          Nome personalizado
        </span>
        <input
          autoComplete="off"
          className="w-full rounded-xl border border-white/10 bg-[#111319] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
          defaultValue={card?.name}
          maxLength={100}
          name="name"
          placeholder="Ex.: Nubank pessoal"
          required
        />
        <span className="block text-xs text-slate-500">
          Use um nome fácil de reconhecer nas despesas futuras.
        </span>
      </label>
      {state.error ? (
        <p className="text-sm text-red-300" role="alert">
          {state.error}
        </p>
      ) : null}
      <p className="rounded-xl bg-emerald-400/5 px-4 py-3 text-xs leading-5 text-slate-400">
        Guardamos apenas o banco e o nome escolhido. Não informe número,
        validade ou código de segurança do cartão.
      </p>
      <div className="flex justify-end gap-3 pt-1">
        <button
          className="rounded-xl bg-[#32353b] px-4 py-2.5 text-sm text-white hover:bg-[#3c4047]"
          onClick={onClose}
          type="button"
        >
          Cancelar
        </button>
        <button
          className="rounded-xl bg-[#00e599] px-5 py-2.5 text-sm font-semibold text-[#003822] hover:brightness-110 disabled:opacity-60"
          disabled={pending || !selectedBank}
          type="submit"
        >
          {pending ? "Salvando…" : card ? "Salvar alterações" : "Salvar cartão"}
        </button>
      </div>
    </form>
  );
}

export function CreditCardManager({
  cards,
  loadError,
}: CreditCardManagerProps) {
  const [modalCard, setModalCard] = useState<CreditCardListItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingCard, setDeletingCard] = useState<CreditCardListItem | null>(
    null,
  );
  const [deleting, startDeleting] = useTransition();
  const router = useRouter();
  const { notify } = useToast();

  function closeModal() {
    setIsModalOpen(false);
    setModalCard(null);
  }

  function openModal(card?: CreditCardListItem) {
    setModalCard(card ?? null);
    setIsModalOpen(true);
  }

  function removeCard() {
    if (!deletingCard) return;
    startDeleting(async () => {
      const result = await deleteCreditCard(deletingCard.id);
      if (result.error) {
        notify("error", result.error);
        return;
      }
      notify("success", "Cartão excluído.");
      setDeletingCard(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-emerald-300 uppercase">
            Cartões de crédito <span className="mx-1 text-slate-600">/</span>{" "}
            Meus cartões
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Meus cartões
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Cadastre seus cartões para identificá-los nos lançamentos e faturas
            que virão.
          </p>
        </div>
        <button
          className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#00e599] px-5 py-3 text-sm font-semibold text-[#003822] shadow-[0_0_22px_rgba(0,229,153,0.2)] transition hover:brightness-110"
          onClick={() => openModal()}
          type="button"
        >
          <Icon className="size-5" name="plus" /> Adicionar cartão
        </button>
      </header>

      {loadError ? (
        <div className="rounded-2xl border border-red-400/20 bg-[#191c21] px-6 py-10 text-center">
          <h2 className="text-lg font-semibold text-white">
            Não foi possível carregar os cartões
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Tente atualizar a página. Se o problema continuar, verifique se a
            migração do banco foi aplicada.
          </p>
          <button
            className="mt-5 rounded-xl bg-[#32353b] px-4 py-2 text-sm text-white"
            onClick={() => router.refresh()}
            type="button"
          >
            Tentar novamente
          </button>
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-3xl border border-white/5 bg-[#191c21] px-6 py-16 text-center sm:px-12">
          <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-[#272a30] text-emerald-300">
            <Icon className="size-8" name="creditCard" />
          </span>
          <h2 className="mt-5 text-xl font-semibold text-white">
            Nenhum cartão cadastrado ainda
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
            Escolha o banco e dê um nome ao seu primeiro cartão. Você poderá
            usá-lo nos próximos recursos do NexSaldo.
          </p>
          <button
            className="mt-6 rounded-xl bg-[#00e599] px-5 py-3 text-sm font-semibold text-[#003822]"
            onClick={() => openModal()}
            type="button"
          >
            Cadastrar primeiro cartão
          </button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const bank = getBankAppearance(card.bankName);
            const isMercadoPago = bank.key === "mercado-pago";
            return (
              <li
                className={`group relative flex min-h-56 flex-col justify-between overflow-hidden rounded-2xl border p-5 shadow-xl shadow-black/20 transition hover:-translate-y-0.5 ${cardTones[bank.tone] ?? cardTones.emerald}`}
                key={card.id}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute -top-16 -right-10 size-48 rounded-full blur-3xl ${isMercadoPago ? "bg-white/35" : "bg-white/10"}`}
                />
                <div className="relative flex items-start gap-3">
                  <span
                    className={`flex size-11 shrink-0 items-center justify-center rounded-xl border text-sm font-bold ${isMercadoPago ? "border-[#161b24]/20 bg-[#161b24] text-[#ffe600]" : "border-white/15 bg-white/10 text-white"}`}
                  >
                    {bank.monogram}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={`truncate text-base font-semibold ${isMercadoPago ? "text-[#161b24]" : "text-white"}`}
                    >
                      {card.bankName}
                    </p>
                    <p
                      className={`mt-0.5 text-xs ${isMercadoPago ? "text-[#161b24]/70" : "text-white/60"}`}
                    >
                      Banco emissor
                    </p>
                  </div>
                </div>
                <div className="relative mt-5">
                  <CreditCardChip light={isMercadoPago} />
                </div>
                <div className="relative mt-4">
                  <p
                    className={`text-lg font-semibold tracking-wide break-words ${isMercadoPago ? "text-[#161b24]" : "text-white"}`}
                  >
                    {card.name}
                  </p>
                  <p
                    className={`mt-1 text-xs ${isMercadoPago ? "text-[#161b24]/70" : "text-white/65"}`}
                  >
                    Disponível para vínculos futuros
                  </p>
                </div>
                <div
                  className={`relative -mx-5 mt-5 -mb-5 flex items-center justify-between border-t px-5 py-2.5 ${isMercadoPago ? "border-black/10 bg-black/10" : "border-white/10 bg-black/20"}`}
                >
                  <span
                    className={`text-xs ${isMercadoPago ? "text-[#161b24]/75" : "text-white/70"}`}
                  >
                    Cartão cadastrado
                  </span>
                  <div className="flex gap-1">
                    <button
                      aria-label={`Editar ${card.name}`}
                      className={`rounded-lg p-2 ${isMercadoPago ? "text-[#161b24]/75 hover:bg-black/10 hover:text-[#161b24]" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
                      onClick={() => openModal(card)}
                      type="button"
                    >
                      <Icon className="size-4" name="edit" />
                    </button>
                    <button
                      aria-label={`Excluir ${card.name}`}
                      className={`rounded-lg p-2 ${isMercadoPago ? "text-[#161b24]/75 hover:bg-red-600/15 hover:text-red-800" : "text-white/75 hover:bg-red-400/15 hover:text-red-200"}`}
                      onClick={() => setDeletingCard(card)}
                      type="button"
                    >
                      <Icon className="size-4" name="trash" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
          <li>
            <button
              className="flex min-h-56 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/15 bg-[#191c21]/50 p-6 text-center text-slate-400 transition hover:border-emerald-400/50 hover:bg-[#191c21]"
              onClick={() => openModal()}
              type="button"
            >
              <span className="flex size-12 items-center justify-center rounded-xl bg-[#272a30] text-emerald-300">
                <Icon className="size-6" name="plus" />
              </span>
              <span className="mt-4 font-semibold text-white">
                Cadastrar novo cartão
              </span>
              <span className="mt-1 text-xs">
                Adicione outro banco ou cartão
              </span>
            </button>
          </li>
        </ul>
      )}

      {isModalOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0e13]/85 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
          role="dialog"
          aria-label={modalCard ? "Editar cartão" : "Adicionar cartão"}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#1d2026] shadow-2xl">
            <div className="flex items-start justify-between border-b border-white/5 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {modalCard ? "Editar cartão" : "Adicionar cartão"}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Identifique o cartão para organizar seus gastos futuros.
                </p>
              </div>
              <button
                aria-label="Fechar formulário"
                className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
                onClick={closeModal}
                type="button"
              >
                <Icon className="size-5" name="close" />
              </button>
            </div>
            <CreditCardForm
              card={modalCard ?? undefined}
              key={modalCard?.id ?? "new"}
              onClose={closeModal}
            />
          </div>
        </div>
      ) : null}

      {deletingCard ? (
        <div
          aria-modal="true"
          aria-label="Confirmar exclusão"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0e13]/85 p-4 backdrop-blur-sm"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1d2026] p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-white">
              Excluir cartão?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              O cadastro de “{deletingCard.name}” será removido. Esta ação não
              pode ser desfeita.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-xl bg-[#32353b] px-4 py-2.5 text-sm text-white"
                disabled={deleting}
                onClick={() => setDeletingCard(null)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="rounded-xl bg-red-400 px-4 py-2.5 text-sm font-semibold text-[#42151a] disabled:opacity-60"
                disabled={deleting}
                onClick={removeCard}
                type="button"
              >
                {deleting ? "Excluindo…" : "Excluir cartão"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
