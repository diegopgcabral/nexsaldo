"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Icon } from "@/components/financial/icons";
import { ManualNegotiationDrawer } from "@/components/investments/manual-negotiation-drawer";
import {
  PortfolioPositionTable,
  type PortfolioPosition,
} from "@/components/investments/portfolio-position-table";

type PortfolioOverviewPosition = Pick<
  PortfolioPosition,
  "assetClass" | "currentAmount" | "institution" | "investedAmount"
> & {
  usdCurrentAmount?: number;
  usdInvestedAmount?: number;
};

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

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

type InstitutionMark = {
  className: string;
  image?: string;
  label: string;
};

function institutionMark(name: string): InstitutionMark {
  const normalized = name.toLocaleLowerCase("pt-BR");
  if (normalized.includes("avenue")) {
    return {
      className: "overflow-hidden bg-[#00372d] text-white",
      image: "/brand/institutions/avenue.png",
      label: "Avenue",
    };
  }
  if (normalized.includes("nubank") || normalized.includes("nu invest")) {
    return { className: "bg-white text-[#820ad1]", label: "Nu" };
  }
  if (normalized.includes("xp")) {
    return { className: "bg-black text-white", label: "XP" };
  }
  if (normalized.includes("inter")) {
    return { className: "bg-[#ff7a00] text-white", label: "in" };
  }
  if (normalized.includes("btg")) {
    return { className: "bg-[#2d65b2] text-white", label: "BTG" };
  }
  return {
    className: "bg-emerald-400/20 text-emerald-200",
    label: name.trim().slice(0, 2).toLocaleUpperCase("pt-BR"),
  };
}

const assetClassLabels: Record<string, string> = {
  BDR: "BDRs",
  BRAZILIAN_ETF: "ETFs brasileiros",
  CASH_BOX: "Caixinhas",
  CRYPTO: "Cripto",
  FII: "FIIs",
  FIXED_INCOME: "Renda fixa",
  FUND: "Fundos",
  PENSION: "Previdência",
  STOCK: "Ações",
  US_ETF: "ETFs americanos",
};

function isFixedIncomeClass(assetClass: string) {
  return assetClass === "FIXED_INCOME" || assetClass === "CASH_BOX";
}

function donutPoint(angle: number, radius: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: 100 + radius * Math.cos(radians),
    y: 100 - radius * Math.sin(radians),
  };
}

function portfolioArc(start: number, end: number) {
  const outerStart = donutPoint(start, 84);
  const outerEnd = donutPoint(end, 84);
  const innerEnd = donutPoint(end, 49);
  const innerStart = donutPoint(start, 49);
  const largeArc = start - end > 180 ? 1 : 0;

  return [
    `M ${outerStart.x.toFixed(3)} ${outerStart.y.toFixed(3)}`,
    `A 84 84 0 ${largeArc} 1 ${outerEnd.x.toFixed(3)} ${outerEnd.y.toFixed(3)}`,
    `L ${innerEnd.x.toFixed(3)} ${innerEnd.y.toFixed(3)}`,
    `A 49 49 0 ${largeArc} 0 ${innerStart.x.toFixed(3)} ${innerStart.y.toFixed(3)}`,
    "Z",
  ].join(" ");
}

export function PortfolioOverviewBoard({
  institutions,
  isValuesVisible,
  positions,
  usdBrl,
}: {
  institutions: string[];
  isValuesVisible: boolean;
  positions: PortfolioOverviewPosition[];
  usdBrl?: number;
}) {
  const [selectedInstitution, setSelectedInstitution] = useState<string | null>(
    null,
  );
  const filteredPositions = useMemo(
    () =>
      selectedInstitution
        ? positions.filter(
            (position) => position.institution === selectedInstitution,
          )
        : positions,
    [positions, selectedInstitution],
  );
  const overview = useMemo(() => {
    const positivePositions = filteredPositions.filter(
      (position) => position.currentAmount > 0,
    );
    const fixedIncome = positivePositions
      .filter((position) => isFixedIncomeClass(position.assetClass))
      .reduce((total, position) => total + position.currentAmount, 0);
    const variableIncome = positivePositions
      .filter((position) => !isFixedIncomeClass(position.assetClass))
      .reduce((total, position) => total + position.currentAmount, 0);
    const investedAmount = positivePositions.reduce(
      (total, position) => total + position.investedAmount,
      0,
    );
    const currentAmount = fixedIncome + variableIncome;
    const usdCurrentAmount = filteredPositions.reduce(
      (total, position) => total + (position.usdCurrentAmount ?? 0),
      0,
    );
    const usdInvestedAmount = filteredPositions.reduce(
      (total, position) => total + (position.usdInvestedAmount ?? 0),
      0,
    );
    const assetClasses = [...new Set(filteredPositions.map((position) => position.assetClass))]
      .map((assetClass) => ({
        label: assetClassLabels[assetClass] ?? assetClass,
        value: filteredPositions
          .filter((position) => position.assetClass === assetClass)
          .reduce((total, position) => total + position.currentAmount, 0),
      }))
      .filter((item) => item.value > 0)
      .sort((first, second) => second.value - first.value);

    return {
      assetClasses,
      currentAmount,
      investedAmount,
      usdCurrentAmount,
      usdInvestedAmount,
      segments: [
        { color: "#00e599", label: "Renda variável", value: variableIncome },
        { color: "#6574ff", label: "Renda fixa", value: fixedIncome },
      ].filter((segment) => segment.value > 0),
    };
  }, [filteredPositions]);

  const arcs = overview.segments.reduce<{
    arcs: Array<(typeof overview.segments)[number] & {
      end: number;
      key: string;
      start: number;
    }>;
    angle: number;
  }>(
    (result, segment, index) => {
      const span =
        overview.currentAmount > 0
          ? (segment.value / overview.currentAmount) * 180
          : 0;
      const gap = overview.segments.length > 1 ? Math.min(2, span / 3) : 0;
      const start = result.angle - gap / 2;
      const end = result.angle - span + gap / 2;

      return {
        angle: result.angle - span,
        arcs: [
          ...result.arcs,
          { ...segment, end, key: `${segment.label}-${index}`, start },
        ],
      };
    },
    { angle: 180, arcs: [] },
  ).arcs;

  const performance = overview.currentAmount - overview.investedAmount;
  const currency = (value: number) =>
    isValuesVisible ? formatCurrency(value) : "••••••••";
  const formatPercentage = (value: number) =>
    isValuesVisible
      ? `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% da carteira`
      : "••••";

  return (
    <section className="overflow-hidden rounded-2xl border border-white/8 bg-[#191c21] shadow-[0_18px_55px_rgba(0,0,0,0.16)]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/8 px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Minha carteira</h2>
          <p className="mt-1 text-sm text-slate-400">
            Visão consolidada de todos os investimentos cadastrados.
          </p>
        </div>
        <Link
          className="inline-flex items-center gap-2 text-xs font-bold tracking-[.12em] text-emerald-300 uppercase transition hover:text-emerald-200"
          href="/investments/portfolio"
        >
          Ir para minha carteira <span aria-hidden="true">→</span>
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto px-5 py-3 sm:px-6">
        <button
          className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold transition ${
            !selectedInstitution
              ? "bg-emerald-400 text-[#003822]"
              : "bg-white/7 text-slate-300 hover:bg-white/10"
          }`}
          onClick={() => setSelectedInstitution(null)}
          type="button"
        >
          Total investido
        </button>
        {institutions.map((institution) => {
          const mark = institutionMark(institution);
          return (
            <button
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${
                selectedInstitution === institution
                  ? "bg-emerald-400 text-[#003822]"
                  : "bg-white/7 text-slate-300 hover:bg-white/10"
              }`}
              key={institution}
              onClick={() => setSelectedInstitution(institution)}
              type="button"
            >
              <span
                aria-hidden="true"
                className={`flex size-5 items-center justify-center rounded-full text-[8px] font-black tracking-[-0.06em] ${mark.className}`}
              >
                {mark.image ? (
                  <Image
                    alt=""
                    className="size-full object-cover"
                    height={20}
                    src={mark.image}
                    width={20}
                  />
                ) : (
                  mark.label
                )}
              </span>
              {institution}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 border-t border-white/8 px-5 pb-4 pt-3 sm:px-6 lg:grid-cols-[minmax(240px,0.8fr)_minmax(340px,1.35fr)] lg:items-center">
        <div className="mx-auto w-full max-w-[320px]">
          {arcs.length ? (
            <svg
              aria-label="Distribuição entre renda variável e renda fixa"
              className="mx-auto block w-full max-w-[390px] overflow-visible"
              role="img"
              viewBox="0 0 200 112"
            >
              {arcs.map((arc) => (
                <path d={portfolioArc(arc.start, arc.end)} fill={arc.color} key={arc.key} />
              ))}
            </svg>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-slate-500">
              Nenhum saldo em carteira para exibir.
            </div>
          )}
        </div>

        <div className="space-y-2 pb-1">
          {overview.segments.map((segment) => {
            const allocationPercentage =
              overview.currentAmount > 0
                ? (segment.value / overview.currentAmount) * 100
                : 0;
            return (
              <div
                className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-white/8 py-2"
                key={segment.label}
              >
                <span
                  aria-hidden="true"
                  className="h-2 w-10 rounded-full"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="text-sm text-slate-300">{segment.label}</span>
                <span className="text-right">
                  <strong className="block text-sm font-semibold text-white">
                    {currency(segment.value)}
                  </strong>
                  <small className="text-xs font-medium text-slate-400">
                    {formatPercentage(allocationPercentage)}
                  </small>
                </span>
              </div>
            );
          })}
          <div className="grid grid-cols-2 gap-3 pt-1 text-sm">
            <div className="rounded-xl border border-white/7 bg-[#15181d] px-3 py-2">
              <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                Valor aplicado
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-200">
                {currency(overview.investedAmount)}
              </p>
            </div>
            <div className="rounded-xl border border-white/7 bg-[#15181d] px-3 py-2">
              <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                Resultado
              </p>
              <p
                className={`mt-1 text-sm font-semibold ${
                  performance >= 0 ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {isValuesVisible ? `${performance >= 0 ? "+" : ""}${formatCurrency(performance)}` : "••••••••"}
              </p>
            </div>
          </div>
          {overview.usdCurrentAmount ? (
            <div className="rounded-xl border border-sky-300/15 bg-sky-400/[0.04] px-3 py-2.5 text-sm">
              <p className="font-medium text-sky-200">ETFs americanos</p>
              <p className="mt-1 text-slate-300">
                {isValuesVisible ? new Intl.NumberFormat("en-US", {
                  currency: "USD",
                  style: "currency",
                })
                  .format(overview.usdCurrentAmount)
                  .replace("$", "US$ ") : "••••••"}
                {" · "}
                <span className="font-semibold text-white">
                  {isValuesVisible && usdBrl
                    ? formatCurrency(
                        filteredPositions
                          .filter((position) => position.assetClass === "US_ETF")
                          .reduce(
                            (total, position) => total + position.currentAmount,
                            0,
                          ),
                      )
                    : isValuesVisible ? "Conversão indisponível" : "••••••"}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Aplicado: {isValuesVisible ? new Intl.NumberFormat("en-US", {
                  currency: "USD",
                  style: "currency",
                })
                  .format(overview.usdInvestedAmount)
                  .replace("$", "US$ ") : "••••••"}
                {isValuesVisible && usdBrl
                  ? ` · dólar a ${formatCurrency(usdBrl)}`
                  : isValuesVisible ? " · conversão do dólar indisponível" : ""}
              </p>
            </div>
          ) : null}
          {overview.assetClasses.length ? (
            <div className="rounded-xl border border-white/7 bg-[#15181d] p-2.5">
              <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                Detalhamento do total
              </p>
              <div className="mt-2 divide-y divide-white/6">
                {overview.assetClasses.map((assetClass) => (
                  <div
                    className="flex items-center justify-between gap-3 py-1 text-xs text-slate-400"
                    key={assetClass.label}
                  >
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true" className="size-1.5 rounded-full bg-slate-500" />
                      {assetClass.label}
                    </span>
                    <strong className="whitespace-nowrap font-semibold text-slate-200">
                      {currency(assetClass.value)}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
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
          const fixedIncomeGroups =
            group.assetClass === "FIXED_INCOME"
              ? [
                  ...new Set(
                    rows.map((row) => row.fixedIncomeSubtype ?? "OTHER"),
                  ),
                ]
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
                aria-expanded={
                  !collapsedPortfolioGroups.includes(group.assetClass)
                }
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
                <Icon
                  className="size-4 shrink-0 text-slate-400"
                  name={
                    collapsedPortfolioGroups.includes(group.assetClass)
                      ? "chevronDown"
                      : "chevronUp"
                  }
                />
              </button>
              {!collapsedPortfolioGroups.includes(group.assetClass) &&
              group.assetClass === "FIXED_INCOME" &&
              rows.length ? (
                <div className="space-y-6 pt-4">
                  {fixedIncomeGroups.map((subgroup) => (
                    <section key={subgroup.label}>
                      <button
                        aria-expanded={
                          !collapsedFixedIncomeGroups.includes(subgroup.subtype)
                        }
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-200 transition hover:bg-white/[0.03] hover:text-emerald-200"
                        onClick={() =>
                          setCollapsedFixedIncomeGroups((current) =>
                            current.includes(subgroup.subtype)
                              ? current.filter(
                                  (item) => item !== subgroup.subtype,
                                )
                              : [...current, subgroup.subtype],
                          )
                        }
                        type="button"
                      >
                        <span className="flex items-center gap-2">
                          {subgroup.label}
                          <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-xs font-medium text-slate-400">
                            {subgroup.rows.length}{" "}
                            {subgroup.rows.length === 1 ? "ativo" : "ativos"}
                          </span>
                        </span>
                        <Icon
                          className="size-4 text-slate-400"
                          name={
                            collapsedFixedIncomeGroups.includes(
                              subgroup.subtype,
                            )
                              ? "chevronDown"
                              : "chevronUp"
                          }
                        />
                      </button>
                      {!collapsedFixedIncomeGroups.includes(
                        subgroup.subtype,
                      ) ? (
                        <PortfolioPositionTable rows={subgroup.rows} />
                      ) : null}
                    </section>
                  ))}
                </div>
              ) : !collapsedPortfolioGroups.includes(group.assetClass) &&
                rows.length ? (
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
