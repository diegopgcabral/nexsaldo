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

function formatUsdTypingValue(raw: string) {
  const [whole, ...decimal] = raw.replace(/[^\d.]/g, "").split(".");
  return decimal.length ? `${whole}.${decimal.join("")}` : whole;
}

export function CurrencyInput({
  currency = "BRL",
  defaultValue,
  name,
  onAmountChange,
  required = false,
}: {
  currency?: "BRL" | "USD";
  defaultValue?: string | number;
  name: string;
  onAmountChange?: (amount: number) => void;
  required?: boolean;
}) {
  const [value, setValue] = useState(() =>
    defaultValue === undefined
      ? ""
      : currency === "USD"
        ? Number(defaultValue).toFixed(2)
        : formatStoredValue(defaultValue),
  );
  const isUsd = currency === "USD";

  return (
    <span className="relative block">
      <span className="absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-semibold text-emerald-300">
        {isUsd ? "$" : "R$"}
      </span>
      <input
        className="income-input text-sm font-semibold placeholder:text-xs"
        inputMode={isUsd ? "decimal" : "numeric"}
        name={name}
        onChange={(event) => {
          const next = isUsd
            ? formatUsdTypingValue(event.target.value)
            : formatTypingValue(event.target.value);
          setValue(next);
          onAmountChange?.(
            isUsd
              ? Number(next) || 0
              : Number(next.replaceAll(".", "").replace(",", ".")),
          );
        }}
        placeholder={isUsd ? "0.00" : "0,00"}
        required={required}
        style={{ paddingLeft: "3rem" }}
        value={value}
      />
    </span>
  );
}
