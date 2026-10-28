"use client";

import { useState } from "react";

function formatTypingValue(raw: string) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(raw.replace(/\D/g, "") || "0") / 100);
}

function formatStoredValue(raw: string | number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(raw));
}

export function CurrencyInput({
  defaultValue,
  name,
  onAmountChange,
  required = false,
}: {
  defaultValue?: string | number;
  name: string;
  onAmountChange?: (amount: number) => void;
  required?: boolean;
}) {
  const [value, setValue] = useState(() =>
    defaultValue === undefined ? "" : formatStoredValue(defaultValue),
  );

  return (
    <span className="relative block">
      <span className="absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-semibold text-emerald-300">
        R$
      </span>
      <input
        className="income-input font-semibold"
        inputMode="numeric"
        name={name}
        onChange={(event) => {
          const next = formatTypingValue(event.target.value);
          setValue(next);
          onAmountChange?.(Number(next.replaceAll(".", "").replace(",", ".")));
        }}
        placeholder="0,00"
        required={required}
        style={{ paddingLeft: "3rem" }}
        value={value}
      />
    </span>
  );
}
