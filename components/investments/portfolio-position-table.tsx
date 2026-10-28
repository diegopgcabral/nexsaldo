"use client";

import { useMemo, useState } from "react";

import { AssetMark } from "@/components/investments/asset-mark";

export type PortfolioPosition = {
  assetClass: string;
  institution: string;
  investedAmount: number;
  name: string;
  quantity: number;
  ticker: string | null;
};

type SortKey =
  | "averagePrice"
  | "institution"
  | "investedAmount"
  | "product"
  | "quantity"
  | "type";
type SortDirection = "asc" | "desc";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(value);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 8 }).format(
    value,
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
  const [sort, setSort] = useState<{ direction: SortDirection; key: SortKey }>({
    direction: "asc",
    key: "product",
  });
  const sortedRows = useMemo(
    () =>
      [...rows].sort((first, second) => {
        const firstValue =
          sort.key === "product"
            ? (first.ticker ?? first.name)
            : sort.key === "type"
              ? assetType(first.assetClass, first.ticker)
              : sort.key === "averagePrice"
                ? first.investedAmount / first.quantity
                : first[sort.key];
        const secondValue =
          sort.key === "product"
            ? (second.ticker ?? second.name)
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
      className={`px-3 py-3 ${align === "right" ? "text-right" : "text-left"}`}
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
      <table className="w-full min-w-[900px] table-fixed text-left text-sm">
        <colgroup>
          <col className="w-[34%]" />
          <col className="w-[12%]" />
          <col className="w-[22%]" />
          <col className="w-[11%]" />
          <col className="w-[11%]" />
          <col className="w-[12%]" />
        </colgroup>
        <thead className="border-b border-white/8 text-xs font-semibold tracking-wide text-slate-400 uppercase">
          <tr>
            {header("Produto", "product")}
            {header("Tipo", "type")}
            {header("Instituição", "institution")}
            {header("Quantidade", "quantity", "right")}
            {header("Preço médio", "averagePrice", "right")}
            {header("Valor investido", "investedAmount", "right")}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/6">
          {sortedRows.map((row) => (
            <tr key={`${row.assetClass}:${row.ticker ?? row.name}`}>
              <td className="px-3 py-3 font-medium text-white">
                <span className="flex min-w-0 items-center gap-3">
                  <AssetMark ticker={row.ticker} />
                  <span className="truncate">{row.ticker ?? row.name}</span>
                </span>
              </td>
              <td className="px-3 py-3 text-slate-400">
                {assetType(row.assetClass, row.ticker)}
              </td>
              <td className="truncate px-3 py-3 text-slate-400">
                {row.institution}
              </td>
              <td className="px-3 py-3 text-right text-slate-200 tabular-nums">
                {formatQuantity(row.quantity)}
              </td>
              <td className="px-3 py-3 text-right text-slate-200 tabular-nums">
                {formatCurrency(row.investedAmount / row.quantity)}
              </td>
              <td className="px-3 py-3 text-right text-slate-200 tabular-nums">
                {formatCurrency(row.investedAmount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
