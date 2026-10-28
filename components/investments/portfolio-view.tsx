"use client";

import { useMemo, useState } from "react";

import { Icon } from "@/components/financial/icons";
import {
  PortfolioPositionTable,
  type PortfolioPosition,
} from "@/components/investments/portfolio-position-table";

const groups = [
  { assetClass: "STOCK", label: "Ações" },
  { assetClass: "FII", label: "FII · Fundo de Investimento Imobiliário" },
  { assetClass: "FIXED_INCOME", label: "Renda fixa" },
] as const;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(value);
}

export function PortfolioView({
  positions,
}: {
  positions: PortfolioPosition[];
}) {
  const [isFilterOpen, setFilterOpen] = useState(false);
  const [assetClasses, setAssetClasses] = useState<string[]>([]);
  const [institutions, setInstitutions] = useState<string[]>([]);
  const availableInstitutions = useMemo(
    () =>
      [
        ...new Set(
          positions
            .map((position) => position.institution)
            .filter((institution) => institution !== "—"),
        ),
      ].sort(),
    [positions],
  );
  const filteredPositions = positions.filter(
    (position) =>
      (assetClasses.length === 0 ||
        assetClasses.includes(position.assetClass)) &&
      (institutions.length === 0 ||
        institutions.includes(position.institution)),
  );
  const toggle = (
    value: string,
    values: string[],
    setValues: (values: string[]) => void,
  ) =>
    setValues(
      values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value],
    );

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[.16em] text-emerald-300 uppercase">
            Investimentos
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            Minha carteira
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Posições atualizadas a partir das negociações importadas.
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-xl bg-[#00e599] px-5 py-2.5 text-sm font-semibold text-[#003822]"
          onClick={() => setFilterOpen(true)}
          type="button"
        >
          <Icon className="size-4" name="filter" />
          Filtrar
        </button>
      </div>
      <div className="mt-8 space-y-8">
        {groups.map((group) => {
          const rows = filteredPositions.filter(
            (position) => position.assetClass === group.assetClass,
          );
          if (!rows.length) return null;
          const total = rows.reduce((sum, row) => sum + row.investedAmount, 0);
          return (
            <section key={group.assetClass}>
              <div className="flex items-center justify-between gap-4 border-b border-emerald-400/45 pb-2 text-sm font-bold text-slate-100">
                <h2>{group.label}</h2>
                <span className="whitespace-nowrap">
                  TOTAL: {formatCurrency(total)}
                </span>
              </div>
              <PortfolioPositionTable rows={rows} />
            </section>
          );
        })}
        {!filteredPositions.length ? (
          <div className="rounded-2xl bg-[#191c21] p-6 text-sm text-slate-400">
            Nenhuma posição corresponde aos filtros selecionados.
          </div>
        ) : null}
      </div>
      <div
        aria-hidden={!isFilterOpen}
        className={`fixed inset-0 z-50 ${isFilterOpen ? "pointer-events-auto" : "pointer-events-none"}`}
      >
        <button
          aria-label="Fechar filtros"
          className={`absolute inset-0 bg-black/55 transition-opacity ${isFilterOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setFilterOpen(false)}
          type="button"
        />
        <aside
          aria-label="Filtros da carteira"
          className={`absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-white/10 bg-[#111319] p-6 shadow-2xl transition-transform duration-300 ${isFilterOpen ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[.16em] text-emerald-300 uppercase">
                Minha carteira
              </p>
              <h2 className="mt-1 text-xl font-semibold text-white">Filtros</h2>
            </div>
            <button
              aria-label="Fechar filtros"
              className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
              onClick={() => setFilterOpen(false)}
              type="button"
            >
              <Icon name="close" />
            </button>
          </div>
          <div className="mt-8 space-y-8 overflow-y-auto">
            <fieldset>
              <legend className="text-sm font-semibold text-white">
                Tipo de ativo
              </legend>
              <div className="mt-3 space-y-3">
                {groups.map((group) => (
                  <label
                    className="flex cursor-pointer items-center gap-3 text-sm text-slate-300"
                    key={group.assetClass}
                  >
                    <input
                      checked={assetClasses.includes(group.assetClass)}
                      className="size-4 accent-emerald-400"
                      onChange={() =>
                        toggle(group.assetClass, assetClasses, setAssetClasses)
                      }
                      type="checkbox"
                    />
                    {group.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-semibold text-white">
                Instituição
              </legend>
              <div className="mt-3 space-y-3">
                {availableInstitutions.map((institution) => (
                  <label
                    className="flex cursor-pointer items-center gap-3 text-sm text-slate-300"
                    key={institution}
                  >
                    <input
                      checked={institutions.includes(institution)}
                      className="size-4 accent-emerald-400"
                      onChange={() =>
                        toggle(institution, institutions, setInstitutions)
                      }
                      type="checkbox"
                    />
                    {institution}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="mt-auto flex gap-3 border-t border-white/8 pt-5">
            <button
              className="flex-1 rounded-xl border border-white/12 px-4 py-2.5 text-sm font-semibold text-slate-300"
              onClick={() => {
                setAssetClasses([]);
                setInstitutions([]);
              }}
              type="button"
            >
              Limpar
            </button>
            <button
              className="flex-1 rounded-xl bg-[#00e599] px-4 py-2.5 text-sm font-semibold text-[#003822]"
              onClick={() => setFilterOpen(false)}
              type="button"
            >
              Ver resultados
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
