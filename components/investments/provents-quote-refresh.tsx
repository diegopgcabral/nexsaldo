"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/financial/icons";

export function ProventsQuoteRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button aria-label="Atualizar cotação do dólar" className="rounded-md p-1 text-slate-400 transition hover:bg-emerald-400/15 hover:text-emerald-200 disabled:opacity-60" disabled={pending} onClick={() => startTransition(() => router.refresh())} title="Atualizar cotação" type="button"><Icon className={`size-4 ${pending ? "animate-spin" : ""}`} name="refresh" /></button>;
}
