"use client";

import { useMemo, useState } from "react";

import { Icon } from "@/components/financial/icons";
import { ManualNegotiationDrawer } from "@/components/investments/manual-negotiation-drawer";
import {
  PortfolioPositionTable,
  type PortfolioPosition,
} from "@/components/investments/portfolio-position-table";

const groups = [
  { assetClass: "STOCK", label: "Ações" },
  { assetClass: "FII", label: "FII · Fundo de Investimento Imobiliário" },
  { assetClass: "FIXED_INCOME", label: "Renda fixa" },
  { assetClass: "US_ETF", label: "ETFs americanos" },
  { assetClass: "BRAZILIAN_ETF", label: "ETFs brasileiros" },
  { assetClass: "BDR", label: "BDRs" },
  { assetClass: "FUND", label: "Fundos de investimento" },
  { assetClass: "PENSION", label: "Previdência" },
  { assetClass: "CRYPTO", label: "Cripto" },
] as const;

const fixedIncomeSubtypeLabels: Record<string, string> = {
  CASH_BOX: "Caixinha",
  CDB: "CDB",
  CRI_CRA: "CRI / CRA",
  DEBENTURE: "Debêntures",
  DIRECT_TREASURY: "Tesouro Direto",
  LCA: "LCA",
  LCI: "LCI",
  OTHER: "Outros",
};

function formatCurrency(value: number, assetClass: string) {
  const isUsdAsset = assetClass === "US_ETF";
  const formatted = new Intl.NumberFormat(isUsdAsset ? "en-US" : "pt-BR", {
    currency: isUsdAsset ? "USD" : "BRL",
    style: "currency",
  }).format(value);
  return isUsdAsset ? formatted.replace("$", "US$ ") : formatted;
}

export function PortfolioView({
  assets,
  institutions,
  positions,
  productTypes,
}: {
  assets: Array<{ assetClass: string; name: string; ticker: string }>;
  institutions: Array<{ id: string; name: string }>;
  positions: PortfolioPosition[];
  productTypes: string[];
}) {
  const [isFilterOpen, setFilterOpen] = useState(false);
  const [isNegotiationOpen, setNegotiationOpen] = useState(false);
  const [negotiationFormKey, setNegotiationFormKey] = useState(0);
  const [collapsedFixedIncomeGroups, setCollapsedFixedIncomeGroups] = useState<
    string[]
  >([]);
  const [collapsedPortfolioGroups, setCollapsedPortfolioGroups] = useState<
    string[]
  >([]);
  const [assetClasses, setAssetClasses] = useState<string[]>([]);
  const [institutionFilters, setInstitutionFilters] = useState<string[]>([]);
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
      (institutionFilters.length === 0 ||
        institutionFilters.includes(position.institution)),
  );
  const activeGroups = groups.filter((group) =>
    productTypes.includes(group.assetClass),
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
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-white/12 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-emerald-400/40 hover:bg-emerald-400/8 hover:text-emerald-200"
            onClick={() => setFilterOpen(true)}
            type="button"
          >
            <Icon className="size-4" name="filter" />
            Filtrar
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-[#00e599] px-5 py-2.5 text-sm font-semibold text-[#003822] transition hover:bg-[#20ebb0]"
            onClick={() => {
              setNegotiationFormKey((current) => current + 1);
              setNegotiationOpen(true);
            }}
            type="button"
          >
            <Icon className="size-4" name="plus" />
            Adicionar negociação
          </button>
        </div>
      </div>
      <div className="mt-8 space-y-8">
        {activeGroups.map((group) => {
          const groupRows = filteredPositions.filter(
            (position) => position.assetClass === group.assetClass,
          );
          const rows =
            group.assetClass === "FIXED_INCOME"
              ? groupRows.filter((position) => position.currentAmount > 0)
              : groupRows;
          const total = rows.reduce(
            (sum, row) =>
              sum +
              (group.assetClass === "FIXED_INCOME"
                ? row.currentAmount
                : row.investedAmount),
            0,
          );
          const fixedIncomeGroups =
            group.assetClass === "FIXED_INCOME"
              ? [...new Set(rows.map((row) => row.fixedIncomeSubtype ?? "OTHER"))]
                  .sort((first, second) =>
                    (fixedIncomeSubtypeLabels[first] ?? first).localeCompare(
                      fixedIncomeSubtypeLabels[second] ?? second,
                      "pt-BR",
                    ),
                  )
                  .map((subtype) => ({
                    label: fixedIncomeSubtypeLabels[subtype] ?? "Outros",
                    subtype,
                    rows: rows.filter(
                      (row) => (row.fixedIncomeSubtype ?? "OTHER") === subtype,
                    ),
                  }))
              : [];
          return (
            <section key={group.assetClass}>
              <button
                aria-expanded={!collapsedPortfolioGroups.includes(group.assetClass)}
                className="sticky top-16 z-10 flex w-full items-center justify-between gap-4 border-b border-emerald-400/45 bg-[#111319] py-2 text-left text-sm font-bold text-slate-100 transition hover:bg-white/[0.025]"
                onClick={() =>
                  setCollapsedPortfolioGroups((current) =>
                    current.includes(group.assetClass)
                      ? current.filter((item) => item !== group.assetClass)
                      : [...current, group.assetClass],
                  )
                }
                type="button"
              >
                <div className="flex items-center gap-2">
                  <h2>{group.label}</h2>
                  <span className="rounded-md bg-emerald-400/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
                    {rows.length} {rows.length === 1 ? "ativo" : "ativos"}
                  </span>
                </div>
                <span className="flex items-center gap-2 whitespace-nowrap">
                  TOTAL: {formatCurrency(total, group.assetClass)}
                  <Icon
                    className="size-4 text-slate-400"
                    name={
                      collapsedPortfolioGroups.includes(group.assetClass)
                        ? "chevronDown"
                        : "chevronUp"
                    }
                  />
                </span>
              </button>
              {!collapsedPortfolioGroups.includes(group.assetClass) && group.assetClass === "FIXED_INCOME" && rows.length ? (
                <div className="space-y-6 pt-4">
                  {fixedIncomeGroups.map((subgroup) => (
                    <section key={subgroup.label}>
                      <button
                        aria-expanded={!collapsedFixedIncomeGroups.includes(subgroup.subtype)}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-200 transition hover:bg-white/[0.03] hover:text-emerald-200"
                        onClick={() =>
                          setCollapsedFixedIncomeGroups((current) =>
                            current.includes(subgroup.subtype)
                              ? current.filter((item) => item !== subgroup.subtype)
                              : [...current, subgroup.subtype],
                          )
                        }
                        type="button"
                      >
                        <span className="flex items-center gap-2">
                          {subgroup.label}
                          <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-xs font-medium text-slate-400">
                            {subgroup.rows.length} {subgroup.rows.length === 1 ? "ativo" : "ativos"}
                          </span>
                        </span>
                        <Icon
                          className="size-4 text-slate-400"
                          name={
                            collapsedFixedIncomeGroups.includes(subgroup.subtype)
                              ? "chevronDown"
                              : "chevronUp"
                          }
                        />
                      </button>
                      {!collapsedFixedIncomeGroups.includes(subgroup.subtype) ? (
                        <PortfolioPositionTable rows={subgroup.rows} />
                      ) : null}
                    </section>
                  ))}
                </div>
              ) : !collapsedPortfolioGroups.includes(group.assetClass) && rows.length ? (
                <PortfolioPositionTable rows={rows} />
              ) : !collapsedPortfolioGroups.includes(group.assetClass) ? (
                <p className="px-3 py-4 text-sm text-slate-500">
                  Nenhum ativo adicionado neste produto.
                </p>
              ) : null}
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
                {activeGroups.map((group) => (
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
                      checked={institutionFilters.includes(institution)}
                      className="size-4 accent-emerald-400"
                      onChange={() =>
                        toggle(
                          institution,
                          institutionFilters,
                          setInstitutionFilters,
                        )
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
                setInstitutionFilters([]);
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
      <ManualNegotiationDrawer
        assets={assets}
        institutions={institutions}
        isOpen={isNegotiationOpen}
        key={negotiationFormKey}
        onClose={() => setNegotiationOpen(false)}
        productTypes={activeGroups.map((group) => group.assetClass)}
      />
    </>
  );
}
