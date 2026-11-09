"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { investmentAssetName } from "@/lib/investments/asset-catalog";

export type PortfolioPosition = {
  assetId: string;
  assetClass: string;
  displayName?: string | null;
  fixedIncomeSubtype?: string | null;
  institution: string;
  investedAmount: number;
  currentAmount: number;
  maturityDate?: string | null;
  name: string;
  quantity: number;
  ticker: string | null;
};

type SortKey =
  | "averagePrice"
  | "institution"
  | "investedAmount"
  | "currentAmount"
  | "name"
  | "product"
  | "quantity"
  | "type";
type SortDirection = "asc" | "desc";

function formatCurrency(value: number, assetClass: string) {
  const isUsdAsset = assetClass === "US_ETF";
  const formatted = new Intl.NumberFormat(isUsdAsset ? "en-US" : "pt-BR", {
    currency: isUsdAsset ? "USD" : "BRL",
    style: "currency",
  }).format(value);
  return isUsdAsset ? formatted.replace("$", "US$ ") : formatted;
}

function formatQuantity(value: number, assetClass: string) {
  return new Intl.NumberFormat(
    assetClass === "US_ETF" ? "en-US" : "pt-BR",
    { maximumFractionDigits: 5 },
  ).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${value}T12:00:00Z`),
  );
}

function assetType(assetClass: string, ticker: string | null) {
  if (assetClass === "FII") return "Cotas";
  if (assetClass === "FIXED_INCOME") return "Título";
  if (ticker?.endsWith("3")) return "ON";
  if (ticker?.endsWith("4")) return "PN";
  if (ticker?.endsWith("11")) return "UNIT";
  return "—";
}

function compareText(first: string, second: string) {
  return first.localeCompare(second, "pt-BR", {
    numeric: true,
    sensitivity: "base",
  });
}

export function PortfolioPositionTable({
  rows,
}: {
  rows: PortfolioPosition[];
}) {
  const isFixedIncome = rows.every((row) => row.assetClass === "FIXED_INCOME");
  const [sort, setSort] = useState<{ direction: SortDirection; key: SortKey }>({
    direction: "desc",
    key: "quantity",
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({
    thumbHeight: 100,
    thumbTop: 0,
    visible: false,
  });
  const updateScrollState = () => {
    const element = scrollRef.current;
    if (!element) return;
    const isScrollable = element.scrollHeight > element.clientHeight;
    const thumbHeight = isScrollable
      ? Math.max(16, (element.clientHeight / element.scrollHeight) * 100)
      : 100;
    const scrollableHeight = element.scrollHeight - element.clientHeight;
    const thumbTop = scrollableHeight
      ? (element.scrollTop / scrollableHeight) * (100 - thumbHeight)
      : 0;
    setScrollState({ thumbHeight, thumbTop, visible: isScrollable });
  };
  useEffect(() => {
    updateScrollState();
    window.addEventListener("resize", updateScrollState);
    return () => window.removeEventListener("resize", updateScrollState);
  }, [rows]);
  const sortedRows = useMemo(
    () =>
      [...rows].sort((first, second) => {
        const firstValue =
          sort.key === "product"
            ? (first.ticker ?? first.name)
            : sort.key === "name"
              ? investmentAssetName(first.ticker, first.name, first.displayName)
            : sort.key === "type"
              ? assetType(first.assetClass, first.ticker)
              : sort.key === "averagePrice"
                ? first.investedAmount / first.quantity
                : first[sort.key];
        const secondValue =
          sort.key === "product"
            ? (second.ticker ?? second.name)
            : sort.key === "name"
              ? investmentAssetName(second.ticker, second.name, second.displayName)
            : sort.key === "type"
              ? assetType(second.assetClass, second.ticker)
              : sort.key === "averagePrice"
                ? second.investedAmount / second.quantity
                : second[sort.key];
        const result =
          typeof firstValue === "number" && typeof secondValue === "number"
            ? firstValue - secondValue
            : compareText(String(firstValue), String(secondValue));
        return sort.direction === "asc" ? result : -result;
      }),
    [rows, sort],
  );
  const changeSort = (key: SortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
  const header = (label: string, key: SortKey, align = "left") => (
    <th
      aria-sort={
        sort.key === key
          ? sort.direction === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
      className={`whitespace-nowrap px-3 py-3 ${align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        className="inline-flex items-center gap-1 hover:text-emerald-300"
        onClick={() => changeSort(key)}
        type="button"
      >
        {label}
        <span
          aria-hidden="true"
          className={sort.key === key ? "text-emerald-300" : "text-slate-600"}
        >
          {sort.key === key && sort.direction === "desc" ? "↓" : "↑"}
        </span>
      </button>
    </th>
  );

  return (
    <div className="overflow-x-auto">
      <div className={isFixedIncome ? "min-w-[860px]" : "min-w-[1020px]"}>
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            {isFixedIncome ? (
              <>
                <col className="w-[24%]" />
                <col className="w-[20%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-[120px]" />
              </>
            ) : (
              <>
                <col className="w-[10%]" />
                <col className="w-[22%]" />
                <col className="w-[8%]" />
                <col className="w-[17%]" />
                <col className="w-[9%]" />
                <col className="w-[10%]" />
                <col className="w-[9%]" />
                <col className="w-[120px]" />
              </>
            )}
          </colgroup>
          <thead className="border-b border-white/8 bg-[#111319] text-[13px] font-semibold tracking-wide text-slate-300 uppercase">
            <tr>
              {isFixedIncome ? (
                <>
                  {header("Produto", "name")}
                  {header("Instituição", "institution")}
                  <th className="whitespace-nowrap px-3 py-3 text-right">Vencimento</th>
                  {header("Valor aplicado", "investedAmount", "right")}
                  {header("Saldo total", "currentAmount", "right")}
                </>
              ) : (
                <>
                  {header("Código", "product")}
                  {header("Nome", "name")}
                  {header("Tipo", "type")}
                  {header("Instituição", "institution")}
                  {header("Quantidade", "quantity", "right")}
                  {header("Preço médio", "averagePrice", "right")}
                  {header("Valor investido", "investedAmount", "right")}
                </>
              )}
              <th aria-label="Detalhes" className="w-[120px] px-3 py-3" />
            </tr>
          </thead>
        </table>
        <div className="relative">
          <div
            className="max-h-[29rem] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onScroll={updateScrollState}
            ref={scrollRef}
          >
            <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              {isFixedIncome ? (
                <>
                  <col className="w-[24%]" />
                  <col className="w-[20%]" />
                  <col className="w-[16%]" />
                  <col className="w-[16%]" />
                  <col className="w-[16%]" />
                  <col className="w-[120px]" />
                </>
              ) : (
                <>
                  <col className="w-[10%]" />
                  <col className="w-[22%]" />
                  <col className="w-[8%]" />
                  <col className="w-[17%]" />
                  <col className="w-[9%]" />
                  <col className="w-[10%]" />
                  <col className="w-[9%]" />
                  <col className="w-[120px]" />
                </>
              )}
            </colgroup>
            <tbody className="divide-y divide-white/6">
              {sortedRows.map((row, index) => (
                <tr
                  className={
                    index % 2 === 0 ? "bg-white/[0.025]" : "bg-transparent"
                  }
                  key={row.assetId}
                >
                  {isFixedIncome ? (
                    <>
                      <td className="truncate px-3 py-3 font-medium text-white">
                        {investmentAssetName(row.ticker, row.name, row.displayName)}
                      </td>
                      <td className="truncate px-3 py-3 text-slate-400">{row.institution}</td>
                      <td className="px-3 py-3 text-right text-slate-200 tabular-nums">
                        {row.maturityDate ? formatDate(row.maturityDate) : "—"}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-200 tabular-nums">
                        {row.fixedIncomeSubtype === "DIRECT_TREASURY"
                          ? formatCurrency(row.investedAmount, row.assetClass)
                          : "—"}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-white tabular-nums">
                        {formatCurrency(row.currentAmount, row.assetClass)}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="truncate px-3 py-3 font-medium text-white">{row.ticker ?? "—"}</td>
                      <td className="truncate px-3 py-3 text-slate-400">{investmentAssetName(row.ticker, row.name, row.displayName)}</td>
                      <td className="px-3 py-3 text-slate-400">{assetType(row.assetClass, row.ticker)}</td>
                      <td className="truncate px-3 py-3 text-slate-400">{row.institution}</td>
                      <td className="px-3 py-3 text-right text-slate-200 tabular-nums">{formatQuantity(row.quantity, row.assetClass)}</td>
                      <td className="px-3 py-3 text-right text-slate-200 tabular-nums">{formatCurrency(row.investedAmount / row.quantity, row.assetClass)}</td>
                      <td className="px-3 py-3 text-right text-slate-200 tabular-nums">{formatCurrency(row.investedAmount, row.assetClass)}</td>
                    </>
                  )}
                  <td className="w-[120px] whitespace-nowrap px-3 py-3 text-right">
                    <Link
                      className="inline-flex w-[88px] items-center justify-center gap-1 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1.5 text-xs font-medium text-emerald-200 transition hover:border-emerald-400/45 hover:bg-emerald-400/15"
                      href={`/investments/portfolio/${row.assetId}`}
                    >
                      Detalhes
                      <span aria-hidden="true">→</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
          {scrollState.visible ? (
            <div className="pointer-events-none absolute inset-y-2 right-1 w-1 rounded-full bg-white/8">
              <span
                className="absolute inset-x-0 rounded-full bg-slate-500"
                style={{
                  height: `${scrollState.thumbHeight}%`,
                  top: `${scrollState.thumbTop}%`,
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
