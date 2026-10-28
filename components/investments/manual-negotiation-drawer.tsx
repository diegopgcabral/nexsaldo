"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createManualInvestmentTransaction,
  type ManualInvestmentTransactionState,
} from "@/app/(financial)/investments/actions";
import { Icon } from "@/components/financial/icons";
import { useToast } from "@/components/financial/toast-provider";

type Institution = { id: string; name: string };

const productLabels: Record<string, string> = {
  BDR: "BDRs",
  BRAZILIAN_ETF: "ETFs brasileiros",
  CRYPTO: "Cripto",
  FII: "FIIs",
  FIXED_INCOME: "Renda fixa",
  FUND: "Fundos de investimento",
  PENSION: "Previdência",
  STOCK: "Ações",
  US_ETF: "ETFs americanos",
};

function todayReference() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export function ManualNegotiationDrawer({
  institutions,
  isOpen,
  onClose,
  productTypes,
}: {
  institutions: Institution[];
  isOpen: boolean;
  onClose: () => void;
  productTypes: string[];
}) {
  const [state, formAction, pending] = useActionState(
    createManualInvestmentTransaction,
    {} as ManualInvestmentTransactionState,
  );
  const [transactionType, setTransactionType] = useState("BUY");
  const { notify } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (state.error) notify("error", state.error);
    if (state.success) {
      notify("success", state.success);
      router.refresh();
      onClose();
    }
  }, [notify, onClose, router, state.error, state.success]);

  return (
    <div
      aria-hidden={!isOpen}
      className={`fixed inset-0 z-60 ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}
    >
      <button
        aria-label="Fechar cadastro de negociação"
        className={`absolute inset-0 bg-black/55 transition-opacity ${isOpen ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
        type="button"
      />
      <aside
        aria-label="Adicionar negociação"
        className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-white/10 bg-[#111319] shadow-2xl transition-transform duration-300 ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/8 p-6">
          <div>
            <p className="text-xs font-semibold tracking-[.16em] text-emerald-300 uppercase">
              Minha carteira
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              Adicionar negociação
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Registre uma compra ou venda feita fora da importação B3.
            </p>
          </div>
          <button
            aria-label="Fechar"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
            onClick={onClose}
            type="button"
          >
            <Icon name="close" />
          </button>
        </div>
        <form action={formAction} className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-5 overflow-y-auto p-6">
            <fieldset>
              <legend className="income-label mb-2">Operação</legend>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["BUY", "Compra"],
                  ["SELL", "Venda"],
                ].map(([value, label]) => (
                  <label
                    className={`cursor-pointer rounded-xl border p-3 text-center text-sm font-medium transition ${transactionType === value ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-200" : "border-white/8 bg-[#191c21] text-slate-400"}`}
                    key={value}
                  >
                    <input
                      checked={transactionType === value}
                      className="sr-only"
                      name="transactionType"
                      onChange={() => setTransactionType(value)}
                      type="radio"
                      value={value}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="space-y-1.5">
              <span className="income-label">Tipo de produto</span>
              <select className="income-input" defaultValue="" name="assetClass" required>
                <option disabled value="">Selecione o tipo</option>
                {productTypes.map((productType) => (
                  <option key={productType} value={productType}>
                    {productLabels[productType] ?? productType}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="income-label">Instituição</span>
              <select className="income-input" defaultValue="" name="institutionId" required>
                <option disabled value="">Selecione a instituição</option>
                {institutions.map((institution) => (
                  <option key={institution.id} value={institution.id}>
                    {institution.name}
                  </option>
                ))}
              </select>
              {!institutions.length ? (
                <span className="block text-xs text-amber-300">
                  Cadastre uma instituição antes de adicionar uma negociação.
                </span>
              ) : null}
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="income-label">Ticker / código</span>
                <input
                  className="income-input uppercase"
                  name="ticker"
                  placeholder="Ex.: ITSA4"
                  required
                />
              </label>
              <label className="space-y-1.5">
                <span className="income-label">Data da negociação</span>
                <input
                  className="income-input [color-scheme:dark]"
                  defaultValue={todayReference()}
                  name="transactionDate"
                  required
                  type="date"
                />
              </label>
            </div>
            <label className="space-y-1.5">
              <span className="income-label">
                Nome do ativo <span className="font-normal text-slate-500">(opcional)</span>
              </span>
              <input
                className="income-input"
                name="name"
                placeholder="Usaremos o ticker se não informar"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="income-label">Quantidade</span>
                <input
                  className="income-input"
                  inputMode="decimal"
                  min="0.00000001"
                  name="quantity"
                  placeholder="0"
                  required
                  step="any"
                  type="number"
                />
              </label>
              <label className="space-y-1.5">
                <span className="income-label">Preço unitário</span>
                <input
                  className="income-input"
                  inputMode="decimal"
                  min="0.000001"
                  name="unitPrice"
                  placeholder="0,00"
                  required
                  step="any"
                  type="number"
                />
              </label>
            </div>
            <label className="space-y-1.5">
              <span className="income-label">Valor total</span>
              <input
                className="income-input"
                inputMode="decimal"
                min="0.01"
                name="totalAmount"
                placeholder="0,00"
                required
                step="0.01"
                type="number"
              />
            </label>
          </div>
          <div className="mt-auto flex gap-3 border-t border-white/8 p-6">
            <button
              className="flex-1 rounded-xl border border-white/12 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/5"
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#00e599] px-4 py-2.5 text-sm font-semibold text-[#003822] disabled:opacity-60"
              disabled={pending || !institutions.length}
              type="submit"
            >
              <Icon className="size-4" name="plus" />
              {pending ? "Salvando…" : "Salvar negociação"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
