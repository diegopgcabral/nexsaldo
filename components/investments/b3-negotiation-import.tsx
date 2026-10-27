"use client";

import { useActionState, useState } from "react";

import { previewB3Negotiations } from "@/app/(financial)/investments/actions";
import type { B3ImportPreviewState } from "@/app/(financial)/investments/actions";
import { Icon } from "@/components/financial/icons";

const labels = {
  FIXED_INCOME: "Tesouro Direto",
  FII: "FIIs",
  STOCK: "Ações",
} as const;

const initialB3ImportPreviewState: B3ImportPreviewState = {
  error: null,
  preview: null,
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(value);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 8,
  }).format(value);
}

export function B3NegotiationImport() {
  const [state, action, pending] = useActionState(
    previewB3Negotiations,
    initialB3ImportPreviewState,
  );
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <form action={action} className="space-y-5">
      <div className="rounded-2xl border border-dashed border-emerald-400/35 bg-[#191c21] px-6 py-8 text-center">
        <label className="block cursor-pointer transition hover:text-emerald-200">
          <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
            <Icon className="size-6" name="archive" />
          </span>
          <span className="mt-4 block font-semibold text-white">
            Selecionar relatório de movimentação
          </span>
          <span className="mx-auto mt-2 block max-w-md text-sm leading-6 text-slate-400">
            Envie o Excel baixado da B3. A primeira importação aceita somente os
            ativos combinados e o Tesouro Direto.
          </span>
          <input
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            name="file"
            onChange={(event) =>
              setFileName(event.target.files?.[0]?.name ?? null)
            }
            required
            type="file"
          />
          <span className="mt-5 inline-flex rounded-xl border border-emerald-400/35 px-5 py-2.5 text-sm font-semibold text-emerald-300">
            {fileName ? "Trocar arquivo" : "Escolher arquivo"}
          </span>
        </label>

        {fileName ? (
          <div className="mx-auto mt-5 max-w-md border-t border-white/8 pt-5">
            <p className="truncate text-sm text-slate-300">{fileName}</p>
            <button
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#00e599] px-5 py-2.5 text-sm font-semibold text-[#003822] disabled:cursor-wait disabled:opacity-60"
              disabled={pending}
              type="submit"
            >
              {pending ? "Lendo relatório..." : "Gerar prévia"}
              {!pending ? (
                <Icon className="size-4" name="chevronRight" />
              ) : null}
            </button>
          </div>
        ) : null}
      </div>

      {state.error ? (
        <p className="rounded-xl bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          {state.error}
        </p>
      ) : null}

      {state.preview ? (
        <section className="rounded-2xl bg-[#191c21] p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">Prévia da importação</h2>
              <p className="mt-1 text-sm text-slate-400">
                {state.preview.items.length} movimentos de negociação em{" "}
                {state.preview.positions.length} ativos serão preparados.
              </p>
            </div>
            <span className="rounded-lg bg-amber-300/10 px-3 py-1.5 text-xs font-medium text-amber-200">
              Ainda não foi salvo
            </span>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-white/8">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-4 bg-white/[0.03] px-4 py-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
              <span>Ativo</span>
              <span>Quantidade</span>
              <span className="text-right">Custo registrado</span>
            </div>
            <div className="divide-y divide-white/6">
              {state.preview.positions.map((position) => (
                <div
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-4 px-4 py-3 text-sm"
                  key={`${position.assetClass}:${position.ticker ?? position.name}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-white">
                      {position.ticker ?? position.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-400">
                      {labels[position.assetClass]}
                    </span>
                  </span>
                  <span className="self-center text-slate-200 tabular-nums">
                    {formatQuantity(position.quantity)}
                  </span>
                  <span className="self-center text-right text-slate-200 tabular-nums">
                    {formatCurrency(position.investedAmount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-400">
            Ignoramos {state.preview.ignoredRows} movimentações que não são
            negociações e {state.preview.excludedAssetRows} linhas de ativos
            fora da lista inicial. Dividendos, rendimentos e JCP entram pela
            opção Proventos.
          </p>
        </section>
      ) : null}
    </form>
  );
}
