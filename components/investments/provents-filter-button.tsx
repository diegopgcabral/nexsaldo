"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Icon } from "@/components/financial/icons";

const productOptions = [
  ["STOCK", "Ações"],
  ["FII", "FIIs"],
  ["US_ETF", "ETFs americanos"],
] as const;

const eventOptions = [
  ["DIVIDEND", "Dividendos"],
  ["JCP", "Juros sobre capital próprio"],
  ["INCOME", "Rendimentos"],
] as const;

function monthValue(value: string | null) {
  return value?.slice(0, 7) ?? "";
}

function firstDayAfter(month: string) {
  const date = new Date(`${month}-01T12:00:00`);
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 10);
}

const monthNames = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function monthLabel(value: string) {
  if (!value) return "Selecione o mês";
  const [year, month] = value.split("-");
  return `${monthNames[Number(month) - 1]} de ${year}`;
}

export function ProventsFilterButton() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const [from, setFrom] = useState(monthValue(params.get("from")));
  const [to, setTo] = useState(monthValue(params.get("to")));
  const [products, setProducts] = useState(
    params.get("products")?.split(",").filter(Boolean) ?? [],
  );
  const [events, setEvents] = useState(
    params.get("events")?.split(",").filter(Boolean) ?? [],
  );
  const [openPicker, setOpenPicker] = useState<"from" | "to" | null>(null);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const currentMonth = new Date().toISOString().slice(0, 7);

  function navigate(next: URLSearchParams) {
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function apply() {
    const next = new URLSearchParams(params.toString());
    if (from) next.set("from", `${from}-01`);
    else next.delete("from");
    if (to) next.set("to", firstDayAfter(to));
    else next.delete("to");
    if (products.length) next.set("products", products.join(","));
    else next.delete("products");
    if (events.length) next.set("events", events.join(","));
    else next.delete("events");
    if (from || to) next.delete("month");
    navigate(next);
    setOpen(false);
  }

  function clear() {
    setFrom("");
    setTo("");
    setProducts([]);
    setEvents([]);
    const next = new URLSearchParams(params.toString());
    next.delete("from");
    next.delete("to");
    next.delete("products");
    next.delete("events");
    next.delete("month");
    navigate(next);
    setOpen(false);
  }

  function toggleProduct(product: string) {
    setProducts((current) =>
      current.includes(product)
        ? current.filter((item) => item !== product)
        : [...current, product],
    );
  }

  function toggleEvent(event: string) {
    setEvents((current) =>
      current.includes(event)
        ? current.filter((item) => item !== event)
        : [...current, event],
    );
  }

  function showPicker(field: "from" | "to") {
    const value = field === "from" ? from : to;
    setPickerYear(Number(value?.slice(0, 4)) || new Date().getFullYear());
    setOpenPicker(field);
  }

  function selectMonth(monthIndex: number) {
    const value = `${pickerYear}-${String(monthIndex + 1).padStart(2, "0")}`;
    if (openPicker === "from") setFrom(value);
    if (openPicker === "to") setTo(value);
    setOpenPicker(null);
  }

  return (
    <>
      <button
        className="rounded-xl border border-white/12 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-emerald-400/40 hover:bg-emerald-400/8 hover:text-emerald-200"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Icon className="mr-2 inline size-4" name="filter" />
        Filtrar
      </button>
      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            aria-label="Fechar filtros"
            className="absolute inset-0 bg-black/55"
            onClick={() => setOpen(false)}
            type="button"
          />
          <aside className="absolute inset-y-0 right-0 w-full max-w-sm border-l border-white/10 bg-[#111319] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold tracking-[.16em] text-emerald-300 uppercase">
                  Proventos recebidos
                </p>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  Filtros
                </h2>
              </div>
              <button
                className="rounded-lg p-2 text-slate-400 hover:bg-white/5"
                onClick={() => setOpen(false)}
                type="button"
              >
                <Icon name="close" />
              </button>
            </div>
            <p className="mt-8 text-sm font-semibold text-white">Período</p>
            <p className="mt-1 text-sm text-slate-400">
              Escolha o mês inicial e final para consultar os recebimentos.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="rounded-lg border border-emerald-400/35 bg-emerald-400/8 px-3 py-1.5 text-xs font-semibold text-emerald-200"
                onClick={() => {
                  setFrom(currentMonth);
                  setTo(currentMonth);
                }}
                type="button"
              >
                Mês atual
              </button>
              <button
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300"
                onClick={() => {
                  setFrom(`${currentMonth.slice(0, 4)}-01`);
                  setTo(currentMonth);
                }}
                type="button"
              >
                Este ano
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              {(["from", "to"] as const).map((field) => {
                const value = field === "from" ? from : to;
                const label = field === "from" ? "De" : "Até";
                return (
                  <div className="relative" key={field}>
                    <p className="text-xs font-medium text-slate-400">
                      {label}
                    </p>
                    <button
                      aria-expanded={openPicker === field}
                      className="mt-1 flex w-full items-center justify-between rounded-lg border border-white/10 bg-[#1b1e24] px-3 py-3 text-left text-sm text-white"
                      onClick={() => showPicker(field)}
                      type="button"
                    >
                      <span className={value ? "" : "text-slate-400"}>
                        {monthLabel(value)}
                      </span>
                      <span className="text-slate-400">⌄</span>
                    </button>
                    {openPicker === field ? (
                      <div className="absolute z-10 mt-2 w-full rounded-xl border border-white/10 bg-[#1b1e24] p-3 shadow-2xl">
                        <div className="mb-3 flex items-center justify-between">
                          <button
                            aria-label="Ano anterior"
                            className="rounded p-1 text-slate-400 hover:bg-white/5"
                            onClick={() => setPickerYear((year) => year - 1)}
                            type="button"
                          >
                            ‹
                          </button>
                          <span className="text-sm font-semibold text-white">
                            {pickerYear}
                          </span>
                          <button
                            aria-label="Próximo ano"
                            className="rounded p-1 text-slate-400 hover:bg-white/5"
                            onClick={() => setPickerYear((year) => year + 1)}
                            type="button"
                          >
                            ›
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {monthNames.map((name, index) => {
                            const optionValue = `${pickerYear}-${String(index + 1).padStart(2, "0")}`;
                            return (
                              <button
                                className={`rounded-lg px-2 py-2 text-xs font-medium ${value === optionValue ? "bg-emerald-400 text-[#003822]" : "text-slate-300 hover:bg-white/7"}`}
                                key={name}
                                onClick={() => selectMonth(index)}
                                type="button"
                              >
                                {name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <p className="mt-8 text-sm font-semibold text-white">
              Tipo de evento
            </p>
            <div className="mt-3 space-y-3">
              {eventOptions.map(([value, label]) => (
                <label
                  className="flex items-center gap-3 text-sm text-slate-300"
                  key={value}
                >
                  <input
                    checked={events.includes(value)}
                    className="size-4 accent-emerald-400"
                    onChange={() => toggleEvent(value)}
                    type="checkbox"
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="mt-8 text-sm font-semibold text-white">
              Tipo de produto
            </p>
            <div className="mt-3 space-y-3">
              {productOptions.map(([value, label]) => (
                <label
                  className="flex items-center gap-3 text-sm text-slate-300"
                  key={value}
                >
                  <input
                    checked={products.includes(value)}
                    className="size-4 accent-emerald-400"
                    onChange={() => toggleProduct(value)}
                    type="checkbox"
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="absolute right-6 bottom-6 left-6 flex gap-3">
              <button
                className="flex-1 rounded-xl border border-white/12 px-4 py-2.5 text-sm font-semibold text-slate-300"
                onClick={clear}
                type="button"
              >
                Limpar
              </button>
              <button
                className="flex-1 rounded-xl bg-[#00e599] px-4 py-2.5 text-sm font-semibold text-[#003822]"
                onClick={apply}
                type="button"
              >
                Filtrar
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
