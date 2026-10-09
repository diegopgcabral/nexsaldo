"use client";

import { useMemo, useState } from "react";

type BalanceChartPoint = {
  date: string;
  valueCents: string;
};

const chartWidth = 100;
const chartLeft = 4;
const chartRight = 96;

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  })
    .format(new Date(`${date}T12:00:00`))
    .replace(".", "");
}

function formatCents(value: string) {
  const cents = BigInt(value);
  const sign = cents < 0n ? "-" : "";
  const absoluteCents = cents < 0n ? -cents : cents;
  const whole = absoluteCents / 100n;
  const fraction = (absoluteCents % 100n).toString().padStart(2, "0");

  return `${sign}R$ ${new Intl.NumberFormat("pt-BR").format(whole)},${fraction}`;
}

function getAxisValue(min: bigint, max: bigint, index: number, total: number) {
  if (total === 1) return min;
  return min + ((max - min) * BigInt(index)) / BigInt(total - 1);
}

export function BalanceEvolutionChart({
  points,
}: {
  points: BalanceChartPoint[];
}) {
  const [activeIndex, setActiveIndex] = useState(points.length - 1);
  const { axisValues, positionedPoints, path } = useMemo(() => {
    const values = points.map((point) => BigInt(point.valueCents));
    const lowest = values.reduce(
      (current, value) => (value < current ? value : current),
      values[0] ?? 0n,
    );
    const highest = values.reduce(
      (current, value) => (value > current ? value : current),
      values[0] ?? 0n,
    );
    const padding = (highest - lowest) / 10n || 100n;
    const min = lowest - padding;
    const max = highest + padding;
    const span = max - min || 1n;
    const calculatedPoints = points.map((point, index) => {
      const value = BigInt(point.valueCents);
      const x =
        points.length === 1
          ? (chartLeft + chartRight) / 2
          : chartLeft +
            (index / (points.length - 1)) * (chartRight - chartLeft);
      const y = 14 + (1 - Number(value - min) / Number(span)) * 64;

      return { ...point, x, y };
    });

    return {
      axisValues: Array.from({ length: 4 }, (_, index) =>
        getAxisValue(min, max, index, 4),
      ).reverse(),
      positionedPoints: calculatedPoints,
      path: calculatedPoints
        .map(
          (point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
        )
        .join(" "),
    };
  }, [points]);
  const activePoint = positionedPoints[activeIndex] ?? positionedPoints.at(-1);
  const labelIndexes = positionedPoints
    .map((_, index) => index)
    .filter(
      (index) =>
        positionedPoints.length <= 5 ||
        index === 0 ||
        index === positionedPoints.length - 1 ||
        index % Math.ceil(positionedPoints.length / 4) === 0,
    );

  return (
    <div className="mt-6">
      <div className="flex gap-3 sm:gap-4">
        <div className="relative h-72 w-20 shrink-0 text-right sm:h-80 sm:w-24">
          <span className="absolute top-0 right-0 text-xs font-medium text-slate-500">
            Saldo (R$)
          </span>
          {axisValues.map((value, index) => {
            const y = 14 + index * (64 / (axisValues.length - 1));
            return (
              <span
                className="absolute right-0 -translate-y-1/2 text-[11px] text-slate-400 sm:text-xs"
                key={value.toString()}
                style={{ top: `${y}%` }}
              >
                {formatCents(value.toString())}
              </span>
            );
          })}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative">
            {activePoint ? (
              <div
                aria-live="polite"
                className={`pointer-events-none absolute z-10 rounded-xl border border-white/10 bg-[#272a30]/95 px-3 py-2 shadow-xl shadow-black/30 backdrop-blur ${activePoint.x < 25 ? "translate-x-0" : activePoint.x > 75 ? "-translate-x-full" : "-translate-x-1/2"}`}
                style={{
                  left: `${(activePoint.x / chartWidth) * 100}%`,
                  top: `${Math.max(2, activePoint.y - 23)}%`,
                }}
              >
                <p className="text-xs text-slate-400">
                  {formatDate(activePoint.date)}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-white">
                  {formatCents(activePoint.valueCents)}
                </p>
              </div>
            ) : null}
            <svg
              aria-label="Evolução do saldo do ciclo. Passe o cursor ou use Tab nos pontos para consultar cada data."
              className="h-72 w-full overflow-visible sm:h-80"
              preserveAspectRatio="none"
              role="img"
              viewBox={`0 0 ${chartWidth} 100`}
            >
              <defs>
                <linearGradient
                  id="dashboard-balance"
                  x1="0"
                  x2="0"
                  y1="0"
                  y2="1"
                >
                  <stop offset="0" stopColor="#00e599" stopOpacity=".3" />
                  <stop offset="1" stopColor="#00e599" stopOpacity="0" />
                </linearGradient>
              </defs>
              {axisValues.map((_, index) => {
                const y = 14 + index * (64 / (axisValues.length - 1));
                return (
                  <line
                    key={y}
                    stroke="#272a30"
                    strokeDasharray="2 3"
                    strokeWidth=".35"
                    x1={chartLeft}
                    x2={chartRight}
                    y1={y}
                    y2={y}
                  />
                );
              })}
              <path
                d={`${path} L ${chartRight} 82 L ${chartLeft} 82 Z`}
                fill="url(#dashboard-balance)"
              />
              <path
                d={path}
                fill="none"
                stroke="#00e599"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              {positionedPoints.map((point, index) => {
                const isActive = index === activeIndex;
                return (
                  <circle
                    aria-label={`${formatDate(point.date)}: ${formatCents(point.valueCents)}`}
                    className="cursor-pointer outline-none"
                    cx={point.x}
                    cy={point.y}
                    fill={isActive ? "#d7ffe9" : "#00e599"}
                    key={point.date}
                    onClick={() => setActiveIndex(index)}
                    onFocus={() => setActiveIndex(index)}
                    onMouseEnter={() => setActiveIndex(index)}
                    r={isActive ? "3" : "2"}
                    stroke="#10131a"
                    strokeWidth=".8"
                    tabIndex={0}
                  />
                );
              })}
            </svg>
          </div>
          <div className="relative mt-2 h-8">
            {labelIndexes.map((index) => {
              const point = positionedPoints[index];
              if (!point) return null;
              return (
                <span
                  className="absolute -translate-x-1/2 text-[11px] text-slate-400 sm:text-xs"
                  key={point.date}
                  style={{ left: `${point.x}%` }}
                >
                  {formatDate(point.date)}
                </span>
              );
            })}
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-xs text-slate-500">
              Data
            </span>
          </div>
        </div>
      </div>
      <p className="mt-1 text-center text-xs text-slate-500">
        Passe o cursor pelos pontos para ver a data e o saldo.
      </p>
    </div>
  );
}
