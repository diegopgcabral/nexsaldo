"use client";

import { useId, useMemo, useState } from "react";

type BalanceChartPoint = { date: string; valueCents: string };

const left = 12;
const right = 988;
const top = 12;
const bottom = 88;

function dateAsDay(date: string) {
  return Date.parse(`${date}T00:00:00Z`) / 86_400_000;
}

function formatDate(date: string, month: "short" | "long" = "short") {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month,
    timeZone: "UTC",
  })
    .format(new Date(`${date}T12:00:00Z`))
    .replace(".", "");
}

function formatCents(value: bigint) {
  const absolute = value < 0n ? -value : value;
  const whole = new Intl.NumberFormat("pt-BR").format(absolute / 100n);
  const fraction = (absolute % 100n).toString().padStart(2, "0");
  return `${value < 0n ? "-" : ""}R$ ${whole},${fraction}`;
}

function formatAxisCents(value: bigint) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value) / 100);
}

export function BalanceEvolutionChart({
  points,
}: {
  points: BalanceChartPoint[];
}) {
  const gradientId = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const { ticks, positionedPoints, path, areaPath } = useMemo(() => {
    const values = points.map((point) => BigInt(point.valueCents));
    const days = points.map((point) => dateAsDay(point.date));
    const firstDay = days[0] ?? 0;
    const lastDay = days.at(-1) ?? firstDay;
    const lowest = values.reduce(
      (min, value) => (value < min ? value : min),
      values[0] ?? 0n,
    );
    const highest = values.reduce(
      (max, value) => (value > max ? value : max),
      values[0] ?? 0n,
    );
    const padding =
      (highest - lowest) / 8n ||
      (highest < 0n ? -highest : highest) / 10n ||
      100n;
    const min = lowest - padding;
    const max = highest + padding;
    const span = max - min;
    const plotted = points.map((point, index) => ({
      ...point,
      value: values[index],
      x:
        firstDay === lastDay
          ? 500
          : left +
            ((days[index] - firstDay) / (lastDay - firstDay)) * (right - left),
      y:
        top + (1 - Number(values[index] - min) / Number(span)) * (bottom - top),
    }));
    const line = plotted.reduce((result, point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      const previous = plotted[index - 1];
      const middle = (previous.x + point.x) / 2;
      return `${result} C ${middle} ${previous.y}, ${middle} ${point.y}, ${point.x} ${point.y}`;
    }, "");
    const first = plotted[0];
    const last = plotted.at(-1);
    return {
      ticks: Array.from(
        { length: 4 },
        (_, index) => max - ((max - min) * BigInt(index)) / 3n,
      ),
      positionedPoints: plotted,
      path: line,
      areaPath:
        first && last
          ? `${line} L ${last.x} ${bottom} L ${first.x} ${bottom} Z`
          : "",
    };
  }, [points]);
  const active =
    activeIndex === null ? undefined : positionedPoints[activeIndex];
  const first = positionedPoints[0];
  const last = positionedPoints.at(-1);
  const startDay = first ? dateAsDay(first.date) : 0;
  const endDay = last ? dateAsDay(last.date) : startDay;
  const dateTicks = Array.from({ length: 5 }, (_, index) => {
    const day = Math.round(startDay + ((endDay - startDay) * index) / 4);
    return new Date(day * 86_400_000).toISOString().slice(0, 10);
  });

  return (
    <div className="mt-5">
      <div className="flex gap-4 sm:gap-6">
        <div
          aria-label="Evolução do saldo. Passe o cursor pela linha ou use Tab para consultar as movimentações."
          className="relative h-56 min-w-0 flex-1 touch-pan-y sm:h-64"
          onPointerMove={(event) => {
            if (event.pointerType === "touch") return;
            const bounds = event.currentTarget.getBoundingClientRect();
            const x = ((event.clientX - bounds.left) / bounds.width) * 1000;
            const nearest = positionedPoints.reduce(
              (selected, point, index) =>
                Math.abs(point.x - x) <
                Math.abs(positionedPoints[selected].x - x)
                  ? index
                  : selected,
              0,
            );
            setActiveIndex(nearest);
          }}
          onPointerLeave={(event) => {
            if (
              event.pointerType !== "touch" &&
              !event.currentTarget.contains(document.activeElement)
            ) {
              setActiveIndex(null);
            }
          }}
          role="group"
        >
          <svg
            aria-hidden="true"
            className="absolute inset-0 size-full"
            preserveAspectRatio="none"
            viewBox="0 0 1000 100"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#00e599" stopOpacity=".24" />
                <stop offset="1" stopColor="#00e599" stopOpacity="0" />
              </linearGradient>
            </defs>
            {ticks.map((_, index) => {
              const y = top + index * ((bottom - top) / (ticks.length - 1));
              return (
                <line
                  key={index}
                  x1={left}
                  x2={right}
                  y1={y}
                  y2={y}
                  stroke="#334155"
                  strokeDasharray="2 5"
                  strokeOpacity=".55"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
            {active ? (
              <line
                x1={active.x}
                x2={active.x}
                y1={top}
                y2={bottom}
                stroke="#5eead4"
                strokeDasharray="4 5"
                strokeOpacity=".45"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            <path d={areaPath} fill={`url(#${gradientId})`} />
            <path
              d={path}
              fill="none"
              stroke="#00e599"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {positionedPoints.map((point, index) => (
            <button
              aria-label={`${formatDate(point.date, "long")}: ${formatCents(point.value)}`}
              className="absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
              key={point.date}
              onClick={() => setActiveIndex(index)}
              onBlur={() => setActiveIndex(null)}
              onFocus={() => setActiveIndex(index)}
              onPointerEnter={() => setActiveIndex(index)}
              style={{ left: `${point.x / 10}%`, top: `${point.y}%` }}
              type="button"
            >
              <span
                className={`rounded-full border-2 border-[#191c21] bg-emerald-400 ${index === activeIndex ? "size-3.5 shadow-[0_0_12px_rgba(0,229,153,0.7)]" : "size-2 opacity-70"}`}
              />
            </button>
          ))}
          {active ? (
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute z-10 w-52 -translate-x-1/2 rounded-xl border border-white/10 bg-[#272a30]/95 px-3 py-2.5 shadow-xl shadow-black/40 backdrop-blur ${active.y < 45 ? "mt-4" : "-mt-4 -translate-y-full"}`}
              style={{
                left: `clamp(104px, ${active.x / 10}%, calc(100% - 104px))`,
                top: `${active.y}%`,
              }}
            >
              <p className="text-xs font-medium text-slate-300">
                {formatDate(active.date, "long")}
              </p>
              <p className="mt-1 text-sm font-semibold whitespace-nowrap text-white">
                Saldo: {formatCents(active.value)}
              </p>
            </div>
          ) : null}
        </div>
        <div className="relative h-56 w-18 shrink-0 text-right sm:h-64 sm:w-20">
          {ticks.map((value, index) => {
            const y = top + index * ((bottom - top) / (ticks.length - 1));
            return (
              <span
                className="absolute right-0 -translate-y-1/2 text-[11px] whitespace-nowrap text-slate-400 sm:text-xs"
                key={index}
                style={{ top: `${y}%` }}
              >
                {formatAxisCents(value)}
              </span>
            );
          })}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-5 pr-22 text-[11px] text-slate-400 sm:pr-26 sm:text-xs">
        {dateTicks.map((date, index) => (
          <span
            className={`${index === 0 ? "text-left" : index === 4 ? "text-right" : "text-center"} ${index === 1 || index === 3 ? "invisible sm:visible" : ""}`}
            key={index}
          >
            {startDay === endDay && index !== 2 ? "" : formatDate(date)}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Passe o cursor pelo gráfico ou use Tab para ver o saldo de cada
        movimentação.
      </p>
    </div>
  );
}
