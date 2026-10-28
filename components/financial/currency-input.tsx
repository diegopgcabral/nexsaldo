"use client";

import { useEffect, useState } from "react";

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
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(raw.replace(/\D/g, "") || "0") / 100);
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
        ? new Intl.NumberFormat("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(Number(defaultValue))
        : formatStoredValue(defaultValue),
  );
  const isUsd = currency === "USD";
  const amountFromValue = (formattedValue: string) =>
    isUsd
      ? Number(formattedValue.replaceAll(",", "")) || 0
      : Number(formattedValue.replaceAll(".", "").replace(",", "."));
  const updateValue = (raw: string) => {
    const next = isUsd
      ? formatUsdTypingValue(raw)
      : formatTypingValue(raw);
    setValue(next);
    onAmountChange?.(amountFromValue(next));
  };

  useEffect(() => {
    const amount = isUsd
      ? Number(value.replaceAll(",", "")) || 0
      : Number(value.replaceAll(".", "").replace(",", "."));
    onAmountChange?.(amount);
  }, [isUsd, onAmountChange, value]);

  return (
    <span className="relative block">
      <span className="absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-semibold text-emerald-300">
        {isUsd ? "$" : "R$"}
      </span>
      <input
        className="income-input text-sm font-semibold placeholder:text-xs"
        inputMode={isUsd ? "decimal" : "numeric"}
        name={name}
        onChange={(event) => updateValue(event.target.value)}
        placeholder={isUsd ? "0.00" : "0,00"}
        required={required}
        style={{ paddingLeft: "3rem" }}
        value={value}
      />
    </span>
  );
}
