"use client";

import { useState } from "react";

type Category = { category: string; paidCents: string };

const colors = ["#00e599", "#4edea3", "#7bd0ff", "#c4a7ff", "#fda4af"];
const center = 60;
const outerRadius = 53;
const innerRadius = 34;

function formatCents(value: bigint) {
  const absolute = value < 0n ? -value : value;
  const whole = new Intl.NumberFormat("pt-BR").format(absolute / 100n);
  const fraction = (absolute % 100n).toString().padStart(2, "0");
  return `${value < 0n ? "-" : ""}R$ ${whole},${fraction}`;
}

function pointAt(angle: number, radius: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: center + radius * Math.cos(radians),
    y: center + radius * Math.sin(radians),
  };
}

function donutArc(start: number, end: number) {
  const outerStart = pointAt(start, outerRadius);
  const outerEnd = pointAt(end, outerRadius);
  const innerEnd = pointAt(end, innerRadius);
  const innerStart = pointAt(start, innerRadius);
  const largeArc = end - start > 180 ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

export function ExpenseCategoryDonut({
  categories,
}: {
  categories: Category[];
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const totalCents = categories.reduce(
    (total, category) => total + BigInt(category.paidCents),
    0n,
  );
  const segments = categories.reduce<
    Array<{
      category: string;
      paidCents: bigint;
      color: string;
      percentage: number;
      start: number;
      end: number;
    }>
  >((items, category, index) => {
    const paidCents = BigInt(category.paidCents);
    const percentage = Number((paidCents * 10_000n) / totalCents) / 100;
    const start = items.at(-1)?.end ?? 0;
    return [
      ...items,
      {
        category: category.category,
        paidCents,
        color: colors[index % colors.length],
        percentage,
        start,
        end: start + percentage * 3.6,
      },
    ];
  }, []);
  const active = activeIndex === null ? undefined : segments[activeIndex];

  return (
    <div className="mt-6">
      <div className="relative mx-auto flex w-fit items-center justify-center">
        <svg
          aria-label="Distribuição das despesas pagas por categoria"
          className="size-48 overflow-visible sm:size-52"
          role="img"
          viewBox="0 0 120 120"
        >
          {segments.map((segment, index) => {
            const isOnlySegment = segments.length === 1;
            return isOnlySegment ? (
              <circle
                cx={center}
                cy={center}
                fill="none"
                key={segment.category}
                onBlur={() => setActiveIndex(null)}
                onFocus={() => setActiveIndex(index)}
                onPointerEnter={() => setActiveIndex(index)}
                onPointerLeave={() => setActiveIndex(null)}
                r={(outerRadius + innerRadius) / 2}
                stroke={segment.color}
                strokeWidth={outerRadius - innerRadius}
                tabIndex={0}
              />
            ) : (
              <path
                className="cursor-pointer transition-opacity outline-none focus-visible:opacity-75"
                d={donutArc(segment.start, segment.end)}
                fill={segment.color}
                key={segment.category}
                onBlur={() => setActiveIndex(null)}
                onFocus={() => setActiveIndex(index)}
                onPointerEnter={() => setActiveIndex(index)}
                onPointerLeave={() => setActiveIndex(null)}
                tabIndex={0}
              >
                <title>{`${segment.category}: ${formatCents(segment.paidCents)}`}</title>
              </path>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute flex size-[57%] flex-col items-center justify-center rounded-full bg-[#191c21] px-3 text-center shadow-inner shadow-black/30">
          <span className="line-clamp-2 text-[11px] font-medium text-slate-400">
            {active?.category ?? "Pago no ciclo"}
          </span>
          <strong className="mt-1 text-sm tracking-tight text-white sm:text-base">
            {formatCents(active?.paidCents ?? totalCents)}
          </strong>
        </div>
      </div>

      <ul
        aria-label="Legenda das despesas por categoria"
        className="mt-6 w-full space-y-2"
      >
        {segments.map((segment, index) => (
          <li
            className={`grid grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)] items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition ${activeIndex === index ? "bg-white/5" : ""}`}
            key={segment.category}
            onPointerEnter={() => setActiveIndex(index)}
            onPointerLeave={() => setActiveIndex(null)}
          >
            <span className="flex min-w-0 items-center gap-2 text-left text-slate-300">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              <span className="truncate" title={segment.category}>
                {segment.category}
              </span>
            </span>
            <span className="text-center text-[13px] text-slate-500">
              {segment.percentage.toFixed(1)} %
            </span>
            <span className="text-right font-medium whitespace-nowrap text-white">
              {formatCents(segment.paidCents)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
