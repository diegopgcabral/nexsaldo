"use client";

import { useState, useTransition } from "react";

import {
  createInvestmentInstitution,
  deleteInvestmentInstitution,
  updateInvestmentInstitution,
} from "@/app/(financial)/investments/actions";
import { Icon } from "@/components/financial/icons";
import { useToast } from "@/components/financial/toast-provider";

type Institution = { id: string; name: string };

const brandStyles = [
  { match: ["nubank", "nu invest"], className: "bg-[#820ad1]/20 text-[#c58cff]", label: "Nu" },
  { match: ["xp"], className: "bg-[#00a889]/15 text-[#4ce3c0]", label: "XP" },
  { match: ["inter"], className: "bg-[#ff7a00]/15 text-[#ffac61]", label: "IN" },
  { match: ["btg"], className: "bg-[#2d65b2]/20 text-[#8cbcff]", label: "BTG" },
  { match: ["itaú", "itau"], className: "bg-[#ec7000]/15 text-[#ffad6d]", label: "Itaú" },
  { match: ["rico"], className: "bg-[#1e70ff]/15 text-[#86b3ff]", label: "R" },
];

function getBrandStyle(name: string) {
  const normalized = name.toLocaleLowerCase("pt-BR");
  const brand = brandStyles.find((style) =>
    style.match.some((match) => normalized.includes(match)),
  );
  return brand ?? {
    className: "bg-emerald-400/10 text-emerald-300",
    label: name.slice(0, 2).toUpperCase(),
  };
}

export function InstitutionManager({
  institutions,
}: {
  institutions: Institution[];
}) {
  const { notify } = useToast();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Institution | null>(null);

  const submitNewInstitution = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createInvestmentInstitution(formData);
      if (result?.error) return notify("error", result.error);
      setName("");
      notify("success", result?.success ?? "Instituição adicionada.");
    });
  };

  const submitEdit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateInvestmentInstitution(formData);
      if (result?.error) return notify("error", result.error);
      setEditing(null);
      notify("success", result?.success ?? "Instituição atualizada.");
    });
  };

  const removeInstitution = (institution: Institution) => {
    if (!window.confirm(`Excluir ${institution.name}? Os produtos permanecerão sem instituição.`)) return;
    startTransition(async () => {
      const result = await deleteInvestmentInstitution(institution.id);
      notify(result?.error ? "error" : "success", result?.error ?? result?.success ?? "Instituição excluída.");
    });
  };

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-[.16em] text-emerald-300 uppercase">
          Investimentos
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Instituições</h1>
        <p className="mt-2 text-sm text-slate-400">
          Organize as corretoras e bancos onde seus investimentos ficam custodiados.
        </p>
      </div>

      <form
        className="rounded-2xl border border-white/6 bg-[#191c21] p-5"
        onSubmit={submitNewInstitution}
      >
        <label className="text-sm font-semibold text-white" htmlFor="institution-name">
          Cadastrar nova instituição
        </label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            className="income-input flex-1"
            disabled={isPending}
            id="institution-name"
            name="name"
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: XP Investimentos, C6 Bank..."
            required
            value={name}
          />
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#00e599] px-5 py-2.5 text-sm font-semibold text-[#003822] disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            <Icon className="size-4" name="plus" />
            Adicionar
          </button>
        </div>
      </form>

      <section className="overflow-hidden rounded-2xl border border-white/6 bg-[#191c21]">
        <div className="flex items-center justify-between border-b border-white/7 px-5 py-4">
          <h2 className="font-semibold text-white">Instituições cadastradas</h2>
          <span className="rounded-md bg-emerald-400/10 px-2 py-1 text-xs text-emerald-200">
            {institutions.length} cadastradas
          </span>
        </div>
        {institutions.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-white/7 bg-[#12151a] text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-3">Instituição</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
            {institutions.map((institution, index) => {
              const brand = getBrandStyle(institution.name);
              return (
                <tr
                  className={`transition hover:bg-emerald-400/[0.04] ${
                    index % 2 === 0 ? "bg-white/[0.025]" : "bg-transparent"
                  }`}
                  key={institution.id}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${brand.className}`}
                      >
                        {brand.label}
                      </span>
                      <p className="font-medium text-white">{institution.name}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-1">
                    <button
                      aria-label={`Editar ${institution.name}`}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-white/6 hover:text-emerald-300"
                      disabled={isPending}
                      onClick={() => setEditing(institution)}
                      type="button"
                    >
                      <Icon className="size-4" name="edit" />
                    </button>
                    <button
                      aria-label={`Excluir ${institution.name}`}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-red-400/10 hover:text-red-300"
                      disabled={isPending}
                      onClick={() => removeInstitution(institution)}
                      type="button"
                    >
                      <Icon className="size-4" name="trash" />
                    </button>
                    </div>
                  </td>
                </tr>
              );
            })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-8 text-sm text-slate-400">Nenhuma instituição cadastrada.</p>
        )}
      </section>

      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <form
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#191c21] p-6 shadow-2xl"
            onSubmit={submitEdit}
          >
            <input name="id" type="hidden" value={editing.id} />
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Editar instituição</h2>
                <p className="mt-1 text-sm text-slate-400">O nome será atualizado em toda a carteira.</p>
              </div>
              <button aria-label="Fechar" className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white" onClick={() => setEditing(null)} type="button"><Icon className="size-4" name="close" /></button>
            </div>
            <input className="income-input mt-5 w-full" defaultValue={editing.name} name="name" required />
            <div className="mt-5 flex justify-end gap-3">
              <button className="rounded-xl border border-white/12 px-4 py-2.5 text-sm font-semibold text-slate-300" onClick={() => setEditing(null)} type="button">Cancelar</button>
              <button className="rounded-xl bg-[#00e599] px-4 py-2.5 text-sm font-semibold text-[#003822]" disabled={isPending} type="submit">Salvar</button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
