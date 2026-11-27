"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  importB3Provents,
  previewB3Provents,
  type B3ProventImportPreviewState,
} from "@/app/(financial)/investments/actions";
import { Icon } from "@/components/financial/icons";

const initialState: B3ProventImportPreviewState = {
  error: null,
  preview: null,
};

const eventLabels = {
  DIVIDEND: "Dividendo",
  JCP: "JCP",
  INCOME: "Rendimento",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 8,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function B3ProventImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] =
    useState<B3ProventImportPreviewState>(initialState);
  const [isDragging, setIsDragging] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [isPreviewing, startPreviewTransition] = useTransition();
  const [isImporting, startImportTransition] = useTransition();
  const router = useRouter();

  function readFile(selectedFile: File | null) {
    if (!selectedFile) return;
    setFile(selectedFile);
    setImportError(null);
    setState(initialState);
    const formData = new FormData();
    formData.set("file", selectedFile);
    startPreviewTransition(async () => {
      setState(await previewB3Provents(initialState, formData));
    });
  }

  function confirmImport() {
    if (!file) {
      setImportError("Selecione novamente o arquivo para importar.");
      return;
    }
    const formData = new FormData();
    formData.set("file", file);
    setImportError(null);
    startImportTransition(async () => {
      const result = await importB3Provents(formData);
      if ("error" in result) {
        setImportError(result.error ?? "Não foi possível importar o arquivo.");
        return;
      }
      router.push(`/investments/provents?month=${result.month}`);
    });
  }

  const hasMissingAssets = Boolean(state.preview?.missingTickers.length);

  return (
    <div className="space-y-5">
      <div
        className={`rounded-2xl border border-dashed bg-[#191c21] px-6 py-8 text-center transition ${isDragging ? "border-emerald-300 bg-emerald-400/5" : "border-emerald-400/35"}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          if (
            !event.relatedTarget ||
            !event.currentTarget.contains(event.relatedTarget as Node)
          )
            setIsDragging(false);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          setIsDragging(true);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          readFile(event.dataTransfer.files?.[0] ?? null);
        }}
      >
        <input
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(event) => readFile(event.target.files?.[0] ?? null)}
          ref={inputRef}
          type="file"
        />
        <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
          <Icon className="size-6" name="money" />
        </span>
        <h2 className="mt-4 font-semibold text-white">Proventos</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
          Arraste o Excel de Proventos da B3 para cá ou selecione o arquivo.
        </p>
        <button
          className="mt-5 rounded-xl bg-[#00e599] px-5 py-2.5 text-sm font-semibold text-[#003822] disabled:cursor-wait disabled:opacity-60"
          disabled={isPreviewing}
          onClick={() => {
            if (!inputRef.current) return;
            inputRef.current.value = "";
            inputRef.current.click();
          }}
          type="button"
        >
          {isPreviewing
            ? "Lendo relatório..."
            : file
              ? "Trocar arquivo Excel"
              : "Selecionar arquivo Excel"}
        </button>
        {file ? (
          <p className="mx-auto mt-3 max-w-md truncate text-sm text-slate-300">
            {file.name}
          </p>
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
                {state.preview.items.length} proventos encontrados. Confira os
                dados antes de salvar.
              </p>
            </div>
            <span className="rounded-lg bg-amber-300/10 px-3 py-1.5 text-xs font-medium text-amber-200">
              Ainda não foi salvo
            </span>
          </div>

          {hasMissingAssets ? (
            <p className="mt-4 rounded-xl bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
              Cadastre estes ativos na carteira antes de importar: {" "}
              <strong>{state.preview.missingTickers.join(", ")}</strong>.
            </p>
          ) : null}

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="border-b border-white/8 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                <tr>
                  <th className="px-3 py-2">Pagamento</th>
                  <th className="px-3 py-2">Ativo</th>
                  <th className="px-3 py-2">Evento</th>
                  <th className="px-3 py-2 text-right">Quantidade</th>
                  <th className="px-3 py-2 text-right">Preço unitário</th>
                  <th className="px-3 py-2 text-right">Valor líquido</th>
                  <th className="px-3 py-2">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {state.preview.items.map((item) => (
                  <tr key={`${item.rowNumber}:${item.ticker}`}>
                    <td className="px-3 py-3 text-slate-300">
                      {formatDate(item.date)}
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-semibold text-white">
                        {item.ticker}
                      </span>
                      {item.assetName ? (
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {item.assetName}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-slate-300">
                      {eventLabels[item.proventType]}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-300 tabular-nums">
                      {formatNumber(item.quantity)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-300 tabular-nums">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-emerald-300 tabular-nums">
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${item.assetId ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-200"}`}
                      >
                        {item.assetId ? "Pronto" : "Ativo não cadastrado"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-5">
            <p className="text-sm text-slate-400">
              Reimportações não duplicam os mesmos proventos.
            </p>
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-[#00e599] px-5 py-2.5 text-sm font-semibold text-[#003822] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isImporting || hasMissingAssets}
              onClick={confirmImport}
              type="button"
            >
              {isImporting
                ? "Importando..."
                : `Importar ${state.preview.items.length} proventos`}
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
    </div>
  );
}
