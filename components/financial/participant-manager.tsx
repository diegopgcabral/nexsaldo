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
  saveParticipant,
  saveOwnerName,
  setParticipantActive,
  type ParticipantActionState,
} from "@/app/(financial)/participants/actions";
import { useToast } from "@/components/financial/toast-provider";
import { Icon } from "@/components/financial/icons";
import type { ParticipantListItem } from "@/lib/financial/participant";

function ParticipantForm({
  person,
  onClose,
}: {
  person?: ParticipantListItem;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    ParticipantActionState,
    FormData
  >(saveParticipant, {});
  const router = useRouter();
  const { notify } = useToast();

  useEffect(() => {
    if (state.success) {
      notify(
        "success",
        person ? "Participante atualizado." : "Participante cadastrado.",
      );
      router.refresh();
      onClose();
    }
  }, [state.success, person, router, notify, onClose]);

  return (
    <form action={formAction} className="space-y-5">
      {person ? <input name="id" type="hidden" value={person.id} /> : null}
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-200">
          Nome do participante
        </span>
        <input
          autoFocus
          autoComplete="off"
          className="w-full rounded-xl border border-white/10 bg-[#111319] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
          defaultValue={person?.name}
          maxLength={100}
          name="name"
          placeholder="Ex.: Ana Paula"
          required
        />
      </label>
      <p className="text-xs leading-5 text-slate-400">
        Essa pessoa poderá ser selecionada no rateio de compras de qualquer
        cartão. Não é necessário informar dados financeiros.
      </p>
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
          className="rounded-xl bg-[#00e599] px-5 py-2.5 text-sm font-semibold text-[#003822] disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Salvando…" : "Salvar participante"}
        </button>
      </div>
    </form>
  );
}

function OwnerForm({
  ownerName,
  onClose,
}: {
  ownerName: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    ParticipantActionState,
    FormData
  >(saveOwnerName, {});
  const router = useRouter();
  const { notify } = useToast();
  useEffect(() => {
    if (state.success) {
      notify("success", "Nome do titular atualizado.");
      router.refresh();
      onClose();
    }
  }, [state.success, notify, router, onClose]);
  return (
    <form action={formAction} className="space-y-5">
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-200">
          Nome do titular nos rateios
        </span>
        <input
          autoFocus
          autoComplete="off"
          className="w-full rounded-xl border border-white/10 bg-[#111319] px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
          defaultValue={ownerName}
          maxLength={100}
          name="name"
          required
        />
      </label>
      <p className="text-xs text-slate-400">
        Esse nome aparece apenas nos rateios dos cartões; não altera seu perfil.
      </p>
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
          className="rounded-xl bg-[#00e599] px-5 py-2.5 text-sm font-semibold text-[#003822] disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Salvando…" : "Salvar nome"}
        </button>
      </div>
    </form>
  );
}

export function ParticipantManager({
  participants,
  ownerName,
  loadError,
}: {
  participants: ParticipantListItem[];
  ownerName: string;
  loadError: boolean;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ParticipantListItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [ownerModalOpen, setOwnerModalOpen] = useState(false);
  const [confirming, setConfirming] = useState<ParticipantListItem | null>(
    null,
  );
  const [busy, startTransition] = useTransition();
  const router = useRouter();
  const { notify } = useToast();
  const active = useMemo(
    () =>
      participants.filter(
        (person) =>
          person.isActive &&
          person.name
            .toLocaleLowerCase("pt-BR")
            .includes(query.toLocaleLowerCase("pt-BR")),
      ),
    [participants, query],
  );
  const archived = participants.filter((person) => !person.isActive);
  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };
  const openModal = (person?: ParticipantListItem) => {
    setEditing(person ?? null);
    setModalOpen(true);
  };

  function changeActive(person: ParticipantListItem, isActive: boolean) {
    startTransition(async () => {
      const result = await setParticipantActive(person.id, isActive);
      if (result.error) notify("error", result.error);
      else {
        notify(
          "success",
          isActive ? "Participante reativado." : "Participante arquivado.",
        );
        router.refresh();
      }
      setConfirming(null);
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-emerald-400 uppercase">
            Cartões de crédito / Participantes
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Participantes
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Cadastre pessoas para dividir compras de qualquer cartão. Os valores
            de cada uma aparecerão nas faturas quando os lançamentos estiverem
            disponíveis.
          </p>
        </div>
        <button
          className="rounded-xl bg-[#00e599] px-5 py-3 text-sm font-semibold text-[#003822] shadow-[0_0_18px_rgba(0,229,153,0.2)]"
          onClick={() => openModal()}
          type="button"
        >
          + Novo participante
        </button>
      </div>
      <div className="flex gap-2 text-sm">
        <Link
          className="rounded-lg px-3 py-2 text-slate-400 hover:text-white"
          href="/cards"
        >
          Meus cartões
        </Link>
        <span className="rounded-lg bg-emerald-400/10 px-3 py-2 text-emerald-300">
          Participantes
        </span>
      </div>
      {loadError ? (
        <p
          className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200"
          role="alert"
        >
          Não foi possível carregar os participantes. Tente atualizar a página.
        </p>
      ) : null}
      <section
        className="space-y-4"
        aria-labelledby="active-participants-heading"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            className="text-lg font-semibold text-white"
            id="active-participants-heading"
          >
            Participantes ativos
          </h2>
          <div className="relative w-full max-w-xs">
            <Icon
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"
              name="search"
            />
            <input
              aria-label="Buscar participante"
              className="w-full rounded-xl border border-white/10 bg-[#1d2026] py-2.5 pr-10 pl-10 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar participante…"
              type="text"
              value={query}
            />
            {query ? (
              <button
                aria-label="Limpar busca"
                className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-white"
                onClick={() => setQuery("")}
                title="Limpar busca"
                type="button"
              >
                <Icon className="size-4" name="close" />
              </button>
            ) : null}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="flex min-h-24 items-center gap-3 rounded-2xl border border-emerald-400/20 bg-[#1d2026] p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400 text-[#003822]">
              <Icon className="size-5" name="person" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-semibold text-white">{ownerName}</h3>
              <p className="text-xs text-emerald-300">Titular da conta</p>
            </div>
            <button
              aria-label="Editar nome do titular"
              className="rounded-lg bg-white/5 p-2 text-slate-200 hover:bg-white/10"
              onClick={() => setOwnerModalOpen(true)}
              title="Editar nome"
              type="button"
            >
              <Icon className="size-4" name="edit" />
            </button>
          </div>
          {active.map((person) => (
            <div
              className="flex min-h-24 items-center gap-3 rounded-2xl border border-white/5 bg-[#1d2026] p-4"
              key={person.id}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#30343b] text-emerald-300">
                <Icon className="size-5" name="person" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold text-white">
                  {person.name}
                </h3>
                <p className="text-xs text-emerald-300">Ativo</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  aria-label={`Editar ${person.name}`}
                  className="rounded-lg bg-white/5 p-2 text-slate-200 hover:bg-white/10"
                  onClick={() => openModal(person)}
                  title="Editar"
                  type="button"
                >
                  <Icon className="size-4" name="edit" />
                </button>
                <button
                  aria-label={`Arquivar ${person.name}`}
                  className="rounded-lg bg-white/5 p-2 text-red-300 hover:bg-red-400/10"
                  onClick={() => setConfirming(person)}
                  title="Arquivar"
                  type="button"
                >
                  <Icon className="size-4" name="trash" />
                </button>
              </div>
            </div>
          ))}
        </div>
        {active.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
            {query
              ? "Nenhum participante encontrado."
              : "Nenhum participante adicional cadastrado. Adicione alguém para futuros rateios."}
          </p>
        ) : null}
      </section>
      {archived.length > 0 ? (
        <section
          className="space-y-3"
          aria-labelledby="archived-participants-heading"
        >
          <h2
            className="text-lg font-semibold text-white"
            id="archived-participants-heading"
          >
            Arquivados
          </h2>
          <p className="text-xs text-slate-400">
            O arquivamento preservará o histórico de rateios quando houver
            faturas.
          </p>
          {archived.map((person) => (
            <div
              className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-[#1d2026] px-4 py-3"
              key={person.id}
            >
              <span className="text-sm text-slate-300">{person.name}</span>
              <button
                className="rounded-lg bg-white/5 px-3 py-2 text-xs text-emerald-300 hover:bg-white/10 disabled:opacity-50"
                disabled={busy}
                onClick={() => changeActive(person, true)}
                type="button"
              >
                Reativar
              </button>
            </div>
          ))}
        </section>
      ) : null}
      {ownerModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOwnerModalOpen(false);
          }}
        >
          <div
            aria-labelledby="owner-dialog-title"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1d2026] p-6 shadow-2xl"
            role="dialog"
          >
            <h2
              className="mb-5 text-xl font-semibold text-white"
              id="owner-dialog-title"
            >
              Editar nome do titular
            </h2>
            <OwnerForm
              ownerName={ownerName}
              onClose={() => setOwnerModalOpen(false)}
            />
          </div>
        </div>
      ) : null}
      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div
            aria-labelledby="participant-dialog-title"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1d2026] p-6 shadow-2xl"
            role="dialog"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2
                  className="text-xl font-semibold text-white"
                  id="participant-dialog-title"
                >
                  {editing ? "Editar participante" : "Novo participante"}
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Identifique quem poderá participar dos rateios.
                </p>
              </div>
              <button
                aria-label="Fechar"
                className="text-slate-400 hover:text-white"
                onClick={closeModal}
                type="button"
              >
                ✕
              </button>
            </div>
            <ParticipantForm
              key={editing?.id ?? "new"}
              person={editing ?? undefined}
              onClose={closeModal}
            />
          </div>
        </div>
      ) : null}
      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div
            aria-labelledby="archive-dialog-title"
            aria-modal="true"
            className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-[#1d2026] p-6"
            role="dialog"
          >
            <h2
              className="text-lg font-semibold text-white"
              id="archive-dialog-title"
            >
              Arquivar {confirming.name}?
            </h2>
            <p className="text-sm text-slate-400">
              Essa pessoa deixará de aparecer nos novos rateios. Você poderá
              reativá-la depois.
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white"
                onClick={() => setConfirming(null)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="rounded-lg bg-red-400/15 px-4 py-2 text-sm text-red-200 disabled:opacity-50"
                disabled={busy}
                onClick={() => changeActive(confirming, false)}
                type="button"
              >
                {busy ? "Arquivando…" : "Arquivar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
