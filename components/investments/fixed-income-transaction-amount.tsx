"use client";

import { useState, useTransition } from "react";

import {
  updateFixedIncomeTransactionAmount,
} from "@/app/(financial)/investments/actions";
import { Icon } from "@/components/financial/icons";
import { useToast } from "@/components/financial/toast-provider";

function formatCurrencyInput(value: string | number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(String(value).replace(/\D/g, "") || "0") / 100);
}

export function FixedIncomeTransactionAmount({
  amount,
  transactionId,
}: {
  amount: number;
  transactionId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(() => formatCurrencyInput(amount));
  const [pending, startTransition] = useTransition();
  const { notify } = useToast();

  if (editing) {
    return (
      <form
        className="flex justify-end gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(async () => {
            const result = await updateFixedIncomeTransactionAmount(
              transactionId,
              {},
              formData,
            );
            if (result.error) {
              notify("error", result.error);
              return;
            }
            if (result.success) notify("success", result.success);
            setEditing(false);
          });
        }}
      >
        <label className="relative block w-32">
          <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs font-semibold text-emerald-300">
            R$
          </span>
          <input
            autoFocus
            className="h-8 w-full rounded-lg border border-emerald-400/40 bg-[#111319] pr-2 pl-8 text-right text-sm font-semibold text-white outline-none focus:border-emerald-300"
            inputMode="numeric"
            name="currentAmount"
            onChange={(event) => setValue(formatCurrencyInput(event.target.value))}
            value={value}
          />
        </label>
        <button
          aria-label="Salvar saldo atualizado"
          className="flex size-8 items-center justify-center rounded-lg bg-[#00e599] text-[#003822] disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          <Icon className="size-3.5" name="check" />
        </button>
        <button
          aria-label="Cancelar edição"
          className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
          onClick={() => {
            setValue(formatCurrencyInput(amount));
            setEditing(false);
          }}
          type="button"
        >
          <Icon className="size-3.5" name="close" />
        </button>
      </form>
    );
  }

  return (
    <div className="inline-flex items-center gap-1">
      <span className="font-medium tabular-nums text-emerald-200">
        {new Intl.NumberFormat("pt-BR", { currency: "BRL", style: "currency" }).format(amount)}
      </span>
      <button
        aria-label="Editar saldo atualizado"
        className="rounded-md p-1 text-slate-400 transition hover:bg-emerald-400/10 hover:text-emerald-200"
        onClick={() => setEditing(true)}
        type="button"
      >
        <Icon className="size-3.5" name="edit" />
      </button>
    </div>
  );
}
