import Link from "next/link";

import { Icon } from "@/components/financial/icons";
import { addMonths, formatMonthReference } from "@/lib/financial/month";

export function CycleMonthNavigator({
  month,
  pathname,
}: {
  month: string;
  pathname: string;
}) {
  return (
    <div
      aria-label="Competência selecionada"
      className="flex min-w-56 items-center justify-between rounded-xl border border-white/10 bg-[#1d2026] px-2 py-1.5 text-sm text-white"
    >
      <Link
        aria-label="Mês anterior"
        className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
        href={`${pathname}?month=${addMonths(month, -1)}`}
      >
        <Icon className="size-4" name="chevronLeft" />
      </Link>
      <span>{formatMonthReference(month)}</span>
      <Link
        aria-label="Próximo mês"
        className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
        href={`${pathname}?month=${addMonths(month, 1)}`}
      >
        <Icon className="size-4" name="chevronRight" />
      </Link>
    </div>
  );
}
