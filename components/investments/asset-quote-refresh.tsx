"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  refreshInvestmentQuote,
  type InvestmentQuoteState,
} from "@/app/(financial)/investments/actions";
import { Icon } from "@/components/financial/icons";

const initialState: InvestmentQuoteState = {};

export function AssetQuoteRefresh({ assetId }: { assetId: string }) {
  const [state, formAction, pending] = useActionState(
    refreshInvestmentQuote,
    initialState,
  );
  const [isAutoRefreshing, startTransition] = useTransition();
  const requested = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    const formData = new FormData();
    formData.set("assetId", assetId);
    startTransition(() => formAction(formData));
  }, [assetId, formAction, startTransition]);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input name="assetId" type="hidden" value={assetId} />
      <button
        aria-label="Atualizar cotação"
        className="rounded-md p-1.5 text-emerald-200 transition hover:bg-emerald-400/15 disabled:cursor-wait disabled:opacity-60"
        disabled={pending || isAutoRefreshing}
        title="Atualizar cotação"
        type="submit"
      >
        <Icon className={`size-4 ${pending || isAutoRefreshing ? "animate-spin" : ""}`} name="refresh" />
      </button>
      {state.error ? <p className="text-xs text-rose-300">{state.error}</p> : null}
    </form>
  );
}
