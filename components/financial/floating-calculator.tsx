"use client";

import { useCallback, useState, type KeyboardEvent } from "react";

import { Icon } from "@/components/financial/icons";

const keys = [
  "AC",
  "⌫",
  "÷",
  "×",
  "7",
  "8",
  "9",
  "−",
  "4",
  "5",
  "6",
  "+",
  "1",
  "2",
  "3",
  "=",
  "0",
  ",",
] as const;

const keyboardKeyMap: Record<string, (typeof keys)[number]> = {
  "*": "×",
  "/": "÷",
  "-": "−",
  ".": ",",
  ",": ",",
  Enter: "=",
  "=": "=",
  Backspace: "⌫",
};

function calculate(expression: string) {
  const normalized = expression
    .replaceAll("×", "*")
    .replaceAll("÷", "/")
    .replaceAll("−", "-");
  const tokens = normalized.match(/\d*\.?\d+|[+\-*/]/g);

  if (!tokens || tokens.join("") !== normalized || tokens.length % 2 === 0) {
    return undefined;
  }

  const values: Array<number | string> = tokens.map((token) =>
    /^[+\-*/]$/.test(token) ? token : Number(token),
  );

  for (let index = 1; index < values.length; index += 2) {
    const operator = values[index];
    if (operator !== "*" && operator !== "/") continue;

    const left = values[index - 1] as number;
    const right = values[index + 1] as number;
    if (operator === "/" && right === 0) return undefined;

    values.splice(index - 1, 3, operator === "*" ? left * right : left / right);
    index -= 2;
  }

  let total = values[0] as number;
  for (let index = 1; index < values.length; index += 2) {
    total =
      values[index] === "+"
        ? total + (values[index + 1] as number)
        : total - (values[index + 1] as number);
  }

  return Number.isFinite(total) ? total : undefined;
}

function formatResult(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 10 }).format(
    value,
  );
}

export function FloatingCalculator() {
  const [isOpen, setIsOpen] = useState(false);
  const [expression, setExpression] = useState("");
  const [error, setError] = useState(false);

  const display = error ? "Erro" : expression || "0";
  const pressKey = useCallback(
    (key: (typeof keys)[number]) => {
      setError(false);

      if (key === "AC") {
        setExpression("");
        return;
      }

      if (key === "⌫") {
        setExpression((value) => value.slice(0, -1));
        return;
      }

      if (key === "=") {
        const result = calculate(expression.replaceAll(",", "."));
        if (result === undefined) {
          setError(true);
          return;
        }
        setExpression(formatResult(result));
        return;
      }

      const operator = ["÷", "×", "−", "+"].includes(key);
      setExpression((value) => {
        if (!operator) return `${value}${key}`;
        if (!value && key !== "−") return value;
        return /[÷×−+]$/.test(value)
          ? `${value.slice(0, -1)}${key}`
          : `${value}${key}`;
      });
    },
    [expression],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!isOpen) return;

      if (event.key === "Escape") {
        event.preventDefault();
        setError(false);
        setExpression("");
        return;
      }

      const mappedKey = keyboardKeyMap[event.key] ?? event.key;
      if (keys.includes(mappedKey as (typeof keys)[number])) {
        event.preventDefault();
        pressKey(mappedKey as (typeof keys)[number]);
      }
    },
    [isOpen, pressKey],
  );

  const toggleCalculator = () => {
    setIsOpen((value) => !value);
  };

  return (
    <div
      className="fixed right-4 bottom-20 z-40 sm:right-6 md:bottom-6"
      onKeyDown={handleKeyDown}
    >
      {isOpen ? (
        <section
          aria-label="Calculadora"
          className="mb-3 w-72 rounded-2xl border border-white/10 bg-[#191c21] p-3 shadow-2xl shadow-black/50"
        >
          <div className="mb-3 flex items-center justify-between px-1">
            <span className="text-sm font-semibold text-white">
              Calculadora
            </span>
            <button
              aria-label="Fechar calculadora"
              className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
              onClick={() => {
                setIsOpen(false);
              }}
              type="button"
            >
              <Icon className="size-4" name="close" />
            </button>
          </div>
          <output className="mb-3 flex min-h-16 items-center justify-end overflow-x-auto rounded-xl bg-[#0b0e13] px-4 text-right text-2xl font-semibold text-white">
            {display}
          </output>
          <div className="grid grid-cols-4 gap-2">
            {keys.map((key) => (
              <button
                className={`h-11 rounded-xl text-sm font-semibold transition hover:brightness-110 active:scale-95 ${key === "=" ? "bg-[#00e599] text-[#003822]" : key === "AC" ? "bg-red-400/15 text-red-200" : "bg-[#272a30] text-slate-100"} ${key === "0" ? "col-span-2" : ""}`}
                key={key}
                onClick={() => pressKey(key)}
                type="button"
              >
                {key}
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <button
        aria-expanded={isOpen}
        aria-label={isOpen ? "Fechar calculadora" : "Abrir calculadora"}
        className="ml-auto flex size-13 items-center justify-center rounded-2xl bg-[#00e599] text-[#003822] shadow-[0_0_24px_rgba(0,229,153,0.35)] transition hover:brightness-110 active:scale-95"
        onClick={toggleCalculator}
        type="button"
      >
        <Icon className="size-6" name="calculator" />
      </button>
    </div>
  );
}
