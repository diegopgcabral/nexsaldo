"use client";

import { useState } from "react";

type Point = { label: string; value: number };
type Range = "days" | "weeks" | "months" | "years";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(value);
}

function formatAxisCurrency(value: number) {
  if (!value) return "R$ 0";
  if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
    })} M`;
  }
  return `R$ ${(value / 1000).toLocaleString("pt-BR", {
    maximumFractionDigits: value % 100000 === 0 ? 0 : 1,
  })} K`;
}

function smoothLine(points: Array<{ x: number; y: number }>) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index];
    const current = points[index];
    const next = points[index + 1];
    const afterNext = points[index + 2] ?? next;
    const firstControl = {
      x: current.x + (next.x - previous.x) / 6,
      y: current.y + (next.y - previous.y) / 6,
    };
    const secondControl = {
      x: next.x - (afterNext.x - current.x) / 6,
      y: next.y - (afterNext.y - current.y) / 6,
    };
    path += ` C ${firstControl.x.toFixed(2)} ${firstControl.y.toFixed(2)}, ${secondControl.x.toFixed(2)} ${secondControl.y.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
  }
  return path;
}

export function PortfolioEvolutionChart({
  isValuesVisible,
  series,
}: {
  isValuesVisible: boolean;
  series: Record<Range, Point[]>;
}) {
  const [range, setRange] = useState<Range>("months");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const points = series[range];
  const maximum = Math.max(...points.map((point) => point.value), 1);
  const stepBase = 10 ** Math.floor(Math.log10(Math.max(maximum / 5, 1)));
  const axisStep = Math.max(
    Math.ceil(maximum / 5 / stepBase) * stepBase,
    200_000,
  );
  const axisMaximum = axisStep * 5;
  const axisValues = Array.from({ length: 6 }, (_, index) => axisMaximum - axisStep * index);
  const chartPoints = points.map((point, index) => {
    const x = points.length > 1 ? (index / (points.length - 1)) * 100 : 50;
    const y = 92 - (point.value / axisMaximum) * 88;
    return { ...point, x, y };
  });
  const line = smoothLine(chartPoints);
  const firstPoint = chartPoints[0];
  const lastPoint = chartPoints.at(-1);
  const area = `${line} L ${lastPoint?.x ?? 0} 92 L ${firstPoint?.x ?? 0} 92 Z`;
  const latest = points.at(-1)?.value ?? 0;
  const hoveredPoint = hoveredIndex === null ? null : chartPoints[hoveredIndex];
  const hiddenCurrency = "R$ ***";

  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-400/20 bg-[#191c21] shadow-[0_18px_45px_rgba(0,0,0,0.16)]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/15 px-5 py-5 sm:px-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Evolução patrimonial</h2>
          <p className="mt-1 text-sm text-slate-400">Acompanhe o valor acumulado da sua carteira.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {(
            [
              ["days", "7 D"],
              ["weeks", "7 S"],
              ["months", "12 M"],
              ["years", "ANOS"],
            ] as Array<[Range, string]>
          ).map(([value, label]) => (
            <button
              className={`rounded-full border px-4 py-2 text-xs font-bold tracking-[.08em] transition ${
                range === value
                  ? "border-emerald-400 bg-emerald-400 text-[#003822]"
                  : "border-white/25 text-slate-200 hover:border-emerald-300/70 hover:text-emerald-200"
              }`}
              key={value}
              onClick={() => {
                setRange(value);
                setHoveredIndex(null);
              }}
              type="button"
            >
              {label}
            </button>
          ))}
          <span className="group relative flex size-8 cursor-help items-center justify-center rounded-full border border-white/25 text-sm font-bold text-slate-300">
            i
            <span className="pointer-events-none absolute right-0 top-10 z-10 w-72 rounded-lg bg-[#111319] px-3 py-2 text-xs font-medium leading-relaxed text-slate-200 opacity-0 shadow-xl transition group-hover:opacity-100">
              Soma do valor de mercado dos seus investimentos no último dia de cada período.
            </span>
          </span>
        </div>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="px-5 py-8 sm:px-6">
          <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-3">
            <div className="flex h-96 flex-col justify-between px-0 pb-[31px] pt-[15px] text-right text-[11px] font-medium text-slate-400">
              {axisValues.map((value) => (
                <span key={value}>
                  {isValuesVisible ? formatAxisCurrency(value) : hiddenCurrency}
                </span>
              ))}
            </div>
            <div className="relative h-96">
              <svg
                aria-label="Evolução patrimonial no período selecionado"
                className="h-full w-full overflow-visible"
                onPointerLeave={() => setHoveredIndex(null)}
                onPointerMove={(event) => {
                  const bounds = event.currentTarget.getBoundingClientRect();
                  const position = (event.clientX - bounds.left) / bounds.width;
                  const index = Math.round(position * (chartPoints.length - 1));
                  setHoveredIndex(Math.max(0, Math.min(chartPoints.length - 1, index)));
                }}
                preserveAspectRatio="none"
                role="img"
                viewBox="0 0 100 100"
              >
              <path
                d="M 0 4 L 0 92"
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="0.45"
              />
              {[4, 21.6, 39.2, 56.8, 74.4, 92].map((lineY) => (
                <path
                  d={`M 0 ${lineY} L 100 ${lineY}`}
                  key={lineY}
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="0.35"
                />
              ))}
              <path d={area} fill="rgba(0,229,153,0.20)" />
              <path d={line} fill="none" stroke="#00e599" strokeWidth="0.9" />
              {hoveredPoint ? (
                <>
                  <path
                    d={`M ${hoveredPoint.x} ${hoveredPoint.y} L ${hoveredPoint.x} 92`}
                    stroke="rgba(255,255,255,0.45)"
                    strokeWidth="0.35"
                  />
                </>
              ) : null}
              </svg>
              {hoveredPoint ? (
                <>
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute z-10 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#f5b942] bg-[#111319]"
                    style={{ left: `${hoveredPoint.x}%`, top: `${hoveredPoint.y}%` }}
                  />
                  <div
                    className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-xl border border-white/15 bg-[#111319] px-3 py-2 text-xs font-bold whitespace-nowrap text-white shadow-xl"
                    style={{ left: `${hoveredPoint.x}%`, top: `${hoveredPoint.y}%` }}
                  >
                    {isValuesVisible ? formatCurrency(hoveredPoint.value) : hiddenCurrency}
                  </div>
                </>
              ) : null}
            </div>
          </div>
          <div className="ml-[77px] -mt-2 flex justify-between text-[10px] font-semibold text-slate-400">
            {points.map((point) => (
              <span key={point.label}>{point.label}</span>
            ))}
          </div>
        </div>
        <aside className="border-t border-white/15 px-5 py-6 lg:border-t-0 sm:px-6">
          <div className="max-h-[420px] space-y-0 overflow-y-auto pr-2">
            {[...points].reverse().slice(0, 7).map((point) => (
              <div
                className="flex items-center justify-between gap-3 border-b border-white/15 py-3 text-sm"
                key={point.label}
              >
                <span className="text-slate-300">{point.label}</span>
                <strong className="font-semibold text-white">
                  {isValuesVisible ? formatCurrency(point.value) : hiddenCurrency}
                </strong>
              </div>
            ))}
          </div>
          <div className="mt-0 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3 text-right lg:mt-[42px]">
            <p className="text-[10px] font-bold tracking-[.12em] text-emerald-200/75 uppercase">
              Total acumulado da carteira
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-300">
              {isValuesVisible ? formatCurrency(latest) : hiddenCurrency}
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
