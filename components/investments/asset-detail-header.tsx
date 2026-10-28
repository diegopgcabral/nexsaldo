"use client";

import { useActionState, useState } from "react";

import {
  updateInvestmentAssetName,
  type UpdateInvestmentAssetState,
} from "@/app/(financial)/investments/actions";
import { Icon } from "@/components/financial/icons";

const initialState: UpdateInvestmentAssetState = {};

export function AssetDetailHeader({
  assetId,
  code,
  initialName,
  institution,
  type,
}: {
  assetId: string;
  code: string;
  initialName: string;
  institution: string;
  type: string;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateInvestmentAssetName.bind(null, assetId),
    initialState,
  );

  return (
    <div className="flex flex-wrap items-start justify-between gap-5">
      <div>
        <p className="text-xs font-semibold tracking-[.16em] text-emerald-300 uppercase">
          Minha carteira / {type}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-3xl font-semibold text-white">{code}</h1>
          {!editing ? (
            <>
              <span className="text-lg text-slate-400">{initialName}</span>
              <button
                aria-label="Editar nome do ativo"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-emerald-200"
                onClick={() => setEditing(true)}
                type="button"
              >
                <Icon className="size-4" name="edit" />
              </button>
            </>
          ) : null}
        </div>
        {editing ? (
          <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
            <input
              aria-label="Nome do ativo"
              className="h-10 min-w-64 rounded-lg border border-white/12 bg-[#111319] px-3 text-sm text-white outline-none transition focus:border-emerald-400"
              defaultValue={initialName}
              name="displayName"
              required
            />
            <button
              className="rounded-lg bg-[#00e599] px-3 py-2 text-sm font-semibold text-[#003822] disabled:opacity-60"
              disabled={pending}
              type="submit"
            >
              {pending ? "Salvando..." : "Salvar"}
            </button>
            <button
              className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-white"
              onClick={() => setEditing(false)}
              type="button"
            >
              Cancelar
            </button>
            {state.error ? <p className="w-full text-sm text-rose-300">{state.error}</p> : null}
          </form>
        ) : null}
        {state.success ? (
          <p className="mt-2 text-sm text-emerald-300">{state.success}</p>
        ) : null}
        <p className="mt-2 text-sm text-slate-400">Custodiado pela {institution}.</p>
      </div>
    </div>
  );
}
