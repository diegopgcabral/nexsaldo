"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createInvestmentProvent,
  type InvestmentProventState,
} from "@/app/(financial)/investments/actions";
import { CurrencyInput } from "@/components/financial/currency-input";
import { Icon } from "@/components/financial/icons";
import { useToast } from "@/components/financial/toast-provider";

type Asset = {
  assetClass: string;
  id: string;
  name: string;
  ticker: string | null;
};

const proventTypes = [
  { label: "Dividendo", value: "DIVIDEND" },
  { label: "JCP", value: "JCP" },
  { label: "Rendimento", value: "INCOME" },
] as const;

const assetGroups = [
  {
    assetClass: "STOCK",
    className: "bg-violet-400/10 text-violet-300",
    icon: "dashboard",
    label: "Ações",
  },
  {
    assetClass: "FII",
    className: "bg-emerald-400/10 text-emerald-300",
    icon: "briefcase",
    label: "FIIs",
  },
  {
    assetClass: "US_ETF",
    className: "bg-blue-400/10 text-blue-300",
    icon: "wallet",
    label: "ETFs americanos",
  },
] as const;

function todayReference() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export function AddProventDrawer({
  assets,
  isOpen,
  returnPath,
}: {
  assets: Asset[];
  isOpen: boolean;
  returnPath: string;
}) {
  const [state, formAction, pending] = useActionState(
    createInvestmentProvent,
    {} as InvestmentProventState,
  );
  const [assetId, setAssetId] = useState("");
  const [isAssetPickerOpen, setAssetPickerOpen] = useState(false);
  const [proventType, setProventType] = useState("DIVIDEND");
  const handledSuccess = useRef(false);
  const router = useRouter();
  const { notify } = useToast();
  const availableAssets = assets.filter((asset) =>
    assetGroups.some((group) => group.assetClass === asset.assetClass),
  );
  const selectedAsset = availableAssets.find((asset) => asset.id === assetId);
  const isUsdAsset = selectedAsset?.assetClass === "US_ETF";

  const close = () => router.replace(returnPath);

  useEffect(() => {
    if (state.error) notify("error", state.error);
    if (state.success && !handledSuccess.current) {
      handledSuccess.current = true;
      notify("success", state.success);
      router.refresh();
      router.replace(returnPath);
    }
  }, [notify, returnPath, router, state.error, state.success]);

  return (
    <div
      aria-hidden={!isOpen}
      className={`fixed inset-0 z-60 ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}
    >
      <button
        aria-label="Fechar cadastro de recebimento"
        className={`absolute inset-0 bg-black/55 transition-opacity ${isOpen ? "opacity-100" : "opacity-0"}`}
        onClick={close}
        type="button"
      />
      <aside
        aria-label="Adicionar recebimento"
        className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-white/10 bg-[#111319] shadow-2xl transition-transform duration-300 ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/8 p-6">
          <div>
            <p className="text-xs font-semibold tracking-[.16em] text-emerald-300 uppercase">
              Proventos
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              Adicionar recebimento
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Registre dividendos, JCP ou rendimentos recebidos.
            </p>
          </div>
          <button
            aria-label="Fechar"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
            onClick={close}
            type="button"
          >
            <Icon name="close" />
          </button>
        </div>
        <form
          action={formAction}
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={() => {
            handledSuccess.current = false;
          }}
        >
          <div className="space-y-6 overflow-y-auto p-6">
            <div className="relative space-y-2.5">
              <span className="block text-sm font-medium text-slate-200">
                Ativo
              </span>
              <input name="assetId" type="hidden" value={assetId} />
              <button
                className="income-input flex min-h-[46px] w-full items-center gap-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!availableAssets.length}
                onClick={() => setAssetPickerOpen((current) => !current)}
                type="button"
              >
                {selectedAsset ? (
                  <>
                    {(() => {
                      const group = assetGroups.find(
                        (item) => item.assetClass === selectedAsset.assetClass,
                      );
                      return group ? (
                        <span
                          className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${group.className}`}
                        >
                          <Icon className="size-4" name={group.icon} />
                        </span>
                      ) : null;
                    })()}
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-100">
                      {selectedAsset.ticker ? `${selectedAsset.ticker} · ` : ""}
                      {selectedAsset.name}
                    </span>
                  </>
                ) : (
                  <span className="flex-1 text-xs text-slate-500">
                    Selecione o ativo
                  </span>
                )}
                <Icon
                  className="size-4 shrink-0 text-slate-400"
                  name={isAssetPickerOpen ? "chevronUp" : "chevronDown"}
                />
              </button>
              {isAssetPickerOpen ? (
                <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-white/8 bg-[#0b0e13] p-2 shadow-2xl">
                  <div className="max-h-72 space-y-3 overflow-y-auto p-1">
                    {assetGroups.map((group) => {
                      const groupAssets = availableAssets.filter(
                        (asset) => asset.assetClass === group.assetClass,
                      );
                      if (!groupAssets.length) return null;
                      return (
                        <div key={group.assetClass}>
                          <p className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                            {group.label}
                          </p>
                          {groupAssets.map((asset) => (
                            <button
                              className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-[#1d2025]"
                              key={asset.id}
                              onClick={() => {
                                setAssetId(asset.id);
                                setAssetPickerOpen(false);
                              }}
                              type="button"
                            >
                              <span
                                className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${group.className}`}
                              >
                                <Icon className="size-4" name={group.icon} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-slate-100">
                                  {asset.ticker ?? asset.name}
                                </span>
                                {asset.ticker ? (
                                  <span className="block truncate text-xs text-slate-400">
                                    {asset.name}
                                  </span>
                                ) : null}
                              </span>
                              {assetId === asset.id ? (
                                <Icon
                                  className="size-4 text-emerald-300"
                                  name="check"
                                />
                              ) : null}
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {!availableAssets.length ? (
                <span className="block text-xs text-amber-300">
                  Adicione ações, FIIs ou ETFs americanos à carteira antes de
                  registrar um recebimento.
                </span>
              ) : null}
            </div>
            <fieldset>
              <legend className="mb-3 text-sm font-medium text-slate-200">
                Tipo de evento
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {proventTypes.map((type) => (
                  <label
                    className={`cursor-pointer rounded-xl border p-3 text-center text-sm font-medium transition ${proventType === type.value ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-200" : "border-white/8 bg-[#191c21] text-slate-400"}`}
                    key={type.value}
                  >
                    <input
                      checked={proventType === type.value}
                      className="sr-only"
                      name="proventType"
                      onChange={() => setProventType(type.value)}
                      type="radio"
                      value={type.value}
                    />
                    {type.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block space-y-2.5">
              <span className="block text-sm font-medium text-slate-200">
                Data de recebimento
              </span>
              <input
                className="income-input text-sm [color-scheme:dark]"
                defaultValue={todayReference()}
                name="receivedOn"
                required
                type="date"
              />
            </label>
            {!isUsdAsset ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block space-y-2.5">
                  <span className="block text-sm font-medium text-slate-200">
                    Quantidade{" "}
                    <span className="font-normal text-slate-500">
                      (opcional)
                    </span>
                  </span>
                  <input
                    className="income-input text-sm placeholder:text-xs"
                    inputMode="decimal"
                    name="quantity"
                    placeholder="Ex.: 100"
                    type="text"
                  />
                </label>
                <label className="block space-y-2.5">
                  <span className="block text-sm font-medium text-slate-200">
                    Valor unitário{" "}
                    <span className="font-normal text-slate-500">
                      (opcional)
                    </span>
                  </span>
                  <CurrencyInput name="unitPrice" />
                </label>
              </div>
            ) : null}
            <label className="block space-y-2.5">
              <span className="block text-sm font-medium text-slate-200">
                Valor líquido recebido
              </span>
              <CurrencyInput
                currency={isUsdAsset ? "USD" : "BRL"}
                key={`amount-${isUsdAsset ? "USD" : "BRL"}`}
                name="amount"
                required
              />
              <span className="block text-xs text-slate-500">
                Informe o valor já líquido de impostos e taxas.
              </span>
            </label>
          </div>
          <div className="mt-auto flex gap-3 border-t border-white/8 p-6">
            <button
              className="flex-1 rounded-xl border border-white/12 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/5"
              onClick={close}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#00e599] px-4 py-2.5 text-sm font-semibold text-[#003822] disabled:opacity-60"
              disabled={pending || !availableAssets.length}
              type="submit"
            >
              <Icon className="size-4" name="plus" />
              {pending ? "Salvando…" : "Salvar recebimento"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
