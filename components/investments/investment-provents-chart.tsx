"use client";

import Link from "next/link";

type MonthValue = {
  label: string;
  value: number;
};

function formatCompactCurrency(value: number) {
  if (value >= 1000) {
    return `R$ ${(value / 1000).toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
    })} mil`;
  }
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
    maximumFractionDigits: 0,
  }).format(value);
}

export function InvestmentProventsChart({
  isValuesVisible,
  months,
}: {
  isValuesVisible: boolean;
  months: MonthValue[];
}) {
  const maximum = Math.max(...months.map((month) => month.value), 1);

  return (
    <section className="overflow-hidden rounded-2xl border border-white/8 bg-[#191c21] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/8 pb-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Proventos recebidos</h2>
          <p className="mt-1 text-sm text-slate-400">
            Valores mensais recebidos, consolidados em reais.
          </p>
        </div>
        <Link
          className="inline-flex items-center gap-2 text-xs font-bold tracking-[.12em] text-emerald-300 uppercase transition hover:text-emerald-200"
          href="/investments/provents"
        >
          Ir para proventos <span aria-hidden="true">→</span>
        </Link>
      </div>
      <div className="mt-8 overflow-x-auto">
        <div className="min-w-[720px] px-2">
          <div className="flex items-end gap-3 border-b border-white/15 pb-0">
          {months.map((month, index) => {
            const height = Math.max((month.value / maximum) * 228, month.value ? 10 : 2);
            return (
              <div className="flex min-w-0 flex-1 flex-col items-center" key={month.label}>
                <span className="mb-2 whitespace-nowrap text-xs font-medium text-slate-300">
                  {isValuesVisible
                    ? month.value
                      ? formatCompactCurrency(month.value)
                      : "—"
                    : "••••"}
                </span>
                <div className="flex h-[228px] w-full items-end justify-center">
                  <div
                    className={`w-full max-w-16 rounded-t-md transition hover:bg-emerald-300 ${
                      index % 2 === 0
                        ? "bg-emerald-400/90"
                        : "bg-[#1d3944]"
                    }`}
                    style={{ height }}
                    title={
                      isValuesVisible
                        ? `${month.label}: ${formatCompactCurrency(month.value)}`
                        : "Valor oculto"
                    }
                  />
                </div>
              </div>
            );
          })}
          </div>
          <div className="flex gap-3 pt-4">
            {months.map((month) => (
              <span
                className="min-w-0 flex-1 text-center text-[11px] font-semibold leading-tight text-slate-400"
                key={month.label}
              >
                {month.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
