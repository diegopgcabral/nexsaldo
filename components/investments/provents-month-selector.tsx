"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function ProventsMonthSelector({ month }: { month: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", value);
    params.delete("assetId");
    router.push(`${pathname}?${params.toString()}`);
  }

  return <label className="flex flex-col gap-1 text-xs font-semibold tracking-wide text-emerald-300 uppercase"><span>Mês e ano</span><input className="rounded-xl border border-white/10 bg-[#191c21] px-3 py-2 text-sm font-medium normal-case tracking-normal text-white outline-none focus:border-emerald-400" onChange={(event) => update(event.target.value)} type="month" value={month} /></label>;
}
