"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  importB3Negotiations,
  previewB3Negotiations,
} from "@/app/(financial)/investments/actions";
import type { B3ImportPreviewState } from "@/app/(financial)/investments/actions";
import { Icon } from "@/components/financial/icons";

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(new Date(`${value}T00:00:00Z`))
    .toUpperCase();
}

export function B3NegotiationImport() {
  const [state, action, pending] = useActionState(
    previewB3Negotiations,
    initialB3ImportPreviewState,
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [isImporting, startImportTransition] = useTransition();
  const router = useRouter();

  function importPreview() {
    if (!file) {
      setImportError(
        "Selecione novamente o arquivo para confirmar a importação.",
      );
      return;
    }
    setImportError(null);
    setImportProgress(5);
    const formData = new FormData();
    formData.set("file", file);
    const timer = window.setInterval(() => {
      setImportProgress((current) => {
        if (current === null) return 5;
        return Math.min(current < 60 ? current + 8 : current + 2, 92);
      });
    }, 350);
    startImportTransition(async () => {
      const result = await importB3Negotiations(formData);
      window.clearInterval(timer);
      if ("error" in result) {
        setImportError(result.error ?? "Não foi possível importar o arquivo.");
        setImportProgress(null);
        return;
      }
      setImportProgress(100);
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      router.push("/investments/portfolio");
    });
  }

  return (
    <form action={action} className="space-y-5">
      <div className="rounded-2xl border border-dashed border-emerald-400/35 bg-[#191c21] px-6 py-8 text-center">
        <label className="block cursor-pointer transition hover:text-emerald-200">
          <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
            <Icon className="size-6" name="archive" />
          </span>
          <span className="mt-4 block font-semibold text-white">
            Selecionar relatório de negociação
          </span>
          <span className="mx-auto mt-2 block max-w-md text-sm leading-6 text-slate-400">
            Envie o Excel de Negociação baixado da B3. A primeira importação
            aceita somente os ativos combinados e o Tesouro Direto.
          </span>
          <input
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            name="file"
            onChange={(event) => {
              const selectedFile = event.target.files?.[0] ?? null;
              setFile(selectedFile);
              setFileName(selectedFile?.name ?? null);
            }}
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

          <div className="mt-5 space-y-6">
            {Object.entries(
              state.preview.items.reduce<
                Record<string, typeof state.preview.items>
              >((groups, item) => {
                groups[item.date] ??= [];
                groups[item.date].push(item);
                return groups;
              }, {}),
            )
              .sort(([firstDate], [secondDate]) =>
                secondDate.localeCompare(firstDate),
              )
              .map(([date, movements]) => (
                <div key={date}>
                  <h3 className="border-b border-emerald-400/45 pb-2 text-sm font-bold text-slate-100">
                    {formatDate(date)}
                  </h3>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[900px] table-fixed text-left text-sm">
                      <colgroup>
                        <col className="w-32" />
                        <col className="w-36" />
                        <col className="w-44" />
                        <col className="w-32" />
                        <col className="w-28" />
                        <col className="w-32" />
                      </colgroup>
                      <thead className="border-b border-white/8 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                        <tr>
                          <th className="w-32 px-3 py-2">Movimentação</th>
                          <th className="px-3 py-2">Instituição</th>
                          <th className="px-3 py-2">Cód. de negociação</th>
                          <th className="px-3 py-2 text-right">Quantidade</th>
                          <th className="px-3 py-2 text-right">
                            Preço unitário
                          </th>
                          <th className="px-3 py-2 text-right">Valor total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/6">
                        {movements.map((movement) => {
                          const isPurchase = movement.transactionType === "BUY";
                          return (
                            <tr key={movement.rowNumber}>
                              <td className="px-3 py-3">
                                <span
                                  className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold tracking-wide uppercase ${isPurchase ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-200"}`}
                                >
                                  {isPurchase ? "Compra" : "Venda"}
                                </span>
                              </td>
                              <td className="truncate px-3 py-3 text-slate-400">
                                {movement.institution}
                              </td>
                              <td className="px-3 py-3 font-medium text-white">
                                {movement.tradeCode}
                              </td>
                              <td className="px-3 py-3 text-right text-slate-200 tabular-nums">
                                {formatQuantity(Math.abs(movement.quantity))}
                              </td>
                              <td className="px-3 py-3 text-right text-slate-200 tabular-nums">
                                {movement.unitPrice === null
                                  ? "—"
                                  : formatCurrency(movement.unitPrice)}
                              </td>
                              <td className="px-3 py-3 text-right text-slate-200 tabular-nums">
                                {movement.totalAmount === null
                                  ? "—"
                                  : formatCurrency(movement.totalAmount)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
          </div>

          {importProgress !== null ? (
            <div className="mt-5 border-t border-white/8 pt-5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-200">
                  Importando negociações
                </span>
                <span className="font-semibold text-emerald-300 tabular-nums">
                  {importProgress}%
                </span>
              </div>
              <div
                aria-label="Progresso da importação"
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={importProgress}
                className="mt-2 h-2 overflow-hidden rounded-full bg-white/8"
                role="progressbar"
              >
                <div
                  className="h-full rounded-full bg-[#00e599] transition-[width] duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-5">
            <p className="text-sm text-slate-400">
              Confira os dados acima antes de gravar na carteira.
            </p>
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-[#00e599] px-5 py-2.5 text-sm font-semibold text-[#003822] disabled:cursor-wait disabled:opacity-60"
              disabled={isImporting}
              onClick={importPreview}
              type="button"
            >
              {isImporting
                ? "Importando..."
                : `Importar ${state.preview.items.length} negociações`}
              {!isImporting ? (
                <Icon className="size-4" name="chevronRight" />
              ) : null}
            </button>
          </div>
          {importError ? (
            <p className="mt-3 rounded-xl bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
              {importError}
            </p>
          ) : null}
        </section>
      ) : null}
    </form>
  );
}
