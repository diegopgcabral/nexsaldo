"use client";

import { useMemo, useState } from "react";

import { Icon } from "@/components/financial/icons";
import type { PortfolioPosition } from "@/components/investments/portfolio-position-table";

const labels: Record<string, string> = {
  BDR: "BDRs",
  BRAZILIAN_ETF: "ETFs brasileiros",
  CASH_BOX: "Caixinhas",
  CRYPTO: "Cripto",
  FII: "FIIs",
  FIXED_INCOME: "Renda fixa",
  FUND: "Fundos de investimento",
  PENSION: "Previdência",
  STOCK: "Ações",
  US_ETF: "ETFs americanos",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(value);
}

function positionName(position: PortfolioPosition) {
  if (position.assetClass === "FIXED_INCOME") {
    const subtypeLabels: Record<string, string> = {
      CASH_BOX: "Caixinhas",
      CDB: "CDB",
      CRI_CRA: "CRI / CRA",
      DEBENTURE: "Debêntures",
      DIRECT_TREASURY: "Tesouro Direto",
      LCA: "LCA",
      LCI: "LCI",
      OTHER: "Outros",
    };
    return subtypeLabels[position.fixedIncomeSubtype ?? "OTHER"] ?? "Outros de renda fixa";
  }
  return labels[position.assetClass] ?? position.assetClass;
}

function ProductsDonut({ value, color }: { value: number; color: string }) {
  const circumference = 2 * Math.PI * 17;
  const clampedValue = Math.max(0, Math.min(100, value));

  return (
    <svg aria-hidden="true" className="size-12 -rotate-90" viewBox="0 0 40 40">
      <circle cx="20" cy="20" fill="none" r="17" stroke="rgba(148,163,184,0.17)" strokeWidth="6" />
      <circle
        cx="20"
        cy="20"
        fill="none"
        r="17"
        stroke={color}
        strokeDasharray={`${(clampedValue / 100) * circumference} ${circumference}`}
        strokeLinecap="butt"
        strokeWidth="6"
      />
    </svg>
  );
}

export function PortfolioProductsBoard({
  isValuesVisible,
  positions,
}: {
  isValuesVisible: boolean;
  positions: PortfolioPosition[];
}) {
  const [expanded, setExpanded] = useState<string[]>([]);
  const [showAll, setShowAll] = useState<string[]>([]);
  const groups = useMemo(() => {
    const total = positions.reduce(
      (sum, position) => sum + Math.max(0, position.currentAmount),
      0,
    );
    const grouped = new Map<string, PortfolioPosition[]>();
    for (const position of positions) {
      const name = positionName(position);
      grouped.set(name, [...(grouped.get(name) ?? []), position]);
    }
    const colors = ["#00e599", "#6574ff", "#f5b942", "#38bdf8", "#d879ff", "#fb7185"];
    return [...grouped.entries()]
      .map(([name, items], index) => {
        const value = items.reduce(
          (sum, position) => sum + Math.max(0, position.currentAmount),
          0,
        );
        return {
          color: colors[index % colors.length],
          count: items.length,
          items,
          name,
          percentage: total ? (value / total) * 100 : 0,
          value,
        };
      })
      .sort((first, second) => second.value - first.value);
  }, [positions]);

  return (
    <section className="rounded-2xl border border-white/8 bg-[#191c21] p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-white">Produtos da sua carteira</h2>
        <p className="mt-1 text-sm text-slate-400">
          {positions.length} {positions.length === 1 ? "ativo" : "ativos"} em {groups.length} {groups.length === 1 ? "produto" : "produtos"}
        </p>
      </div>
      <div className="space-y-2">
        {groups.map((group) => {
          const isExpanded = expanded.includes(group.name);
          const isShowingAll = showAll.includes(group.name);
          const visibleItems = isShowingAll
            ? group.items
            : group.items.slice(0, 5);
          return (
            <div className="overflow-hidden rounded-2xl border border-white/7 bg-[#15181d]" key={group.name}>
              <button
                aria-expanded={isExpanded}
                className="grid w-full grid-cols-[44px_minmax(0,1fr)_auto_24px] items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.025]"
                onClick={() =>
                  setExpanded((current) =>
                    isExpanded
                      ? current.filter((item) => item !== group.name)
                      : [...current, group.name],
                  )
                }
                type="button"
              >
                <ProductsDonut color={group.color} value={group.percentage} />
                <span className="min-w-0">
                  <strong className="block truncate text-sm font-semibold text-slate-100">
                    {group.name}
                  </strong>
                  <small className="mt-1 block text-xs text-slate-400">
                    {isValuesVisible
                      ? `${group.percentage.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% da carteira`
                      : "*** da carteira"}
                  </small>
                </span>
                <span className="text-right">
                  <span className="inline-block rounded-md bg-white/7 px-2 py-1 text-[11px] font-medium text-slate-300">
                    {group.count} {group.count === 1 ? "ativo" : "ativos"}
                  </span>
                  <strong className="mt-1 block text-sm font-semibold text-white">
                    {isValuesVisible ? formatCurrency(group.value) : "R$ ***"}
                  </strong>
                </span>
                <Icon
                  className="size-4 text-emerald-300"
                  name={isExpanded ? "chevronUp" : "chevronDown"}
                />
              </button>
              {isExpanded ? (
                <ul className="space-y-2 border-t border-white/7 p-3 sm:p-4">
                  {visibleItems.map((position) => (
                    <li
                      className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-white/7 bg-[#191c21] px-3 py-3 sm:px-4"
                      key={position.assetId}
                    >
                      <ProductsDonut
                        color={group.color}
                        value={group.value ? (position.currentAmount / group.value) * 100 : 0}
                      />
                      <span className="min-w-0">
                        <small className="block truncate text-[11px] text-slate-500">
                          {position.institution}
                        </small>
                        <strong className="mt-0.5 block truncate text-sm font-semibold text-white">
                          {position.ticker ?? position.name}
                        </strong>
                        <small className="mt-1 block text-[11px] text-slate-400">
                          {isValuesVisible && group.value
                            ? `${((position.currentAmount / group.value) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% do produto`
                            : "*** do produto"}
                        </small>
                      </span>
                      <strong className="whitespace-nowrap text-sm font-semibold text-white">
                        {isValuesVisible
                          ? formatCurrency(position.currentAmount)
                          : "R$ ***"}
                      </strong>
                    </li>
                  ))}
                  {group.items.length > 5 ? (
                    <li className="pt-1 text-center">
                      <button
                        className="rounded-md px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-400/8 hover:text-emerald-200"
                        onClick={() =>
                          setShowAll((current) =>
                            isShowingAll
                              ? current.filter((item) => item !== group.name)
                              : [...current, group.name],
                          )
                        }
                        type="button"
                      >
                        {isShowingAll ? "Exibir menos" : "Exibir todos"}
                      </button>
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
