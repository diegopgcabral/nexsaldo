"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";

import { Icon } from "@/components/financial/icons";

export type DarkSelectOption = { value: string; label: string };

type DarkSelectProps = {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly DarkSelectOption[];
  placeholder: string;
  ariaLabelledBy: string;
  showPersonIcon?: boolean;
  searchable?: boolean;
  renderOptionPrefix?: (option: DarkSelectOption) => ReactNode;
};

export function DarkSelect({
  name,
  value,
  onChange,
  options,
  placeholder,
  ariaLabelledBy,
  showPersonIcon = false,
  searchable = false,
  renderOptionPrefix,
}: DarkSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = options.find((option) => option.value === value);
  const filteredOptions = searchable
    ? options.filter((option) =>
        option.label
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLocaleLowerCase("pt-BR")
          .includes(
            query
              .normalize("NFD")
              .replace(/\p{Diacritic}/gu, "")
              .toLocaleLowerCase("pt-BR"),
          ),
      )
    : options;

  useEffect(() => {
    if (!open) return;

    const selectedOption = listRef.current?.querySelector<HTMLButtonElement>(
      '[aria-selected="true"]',
    );
    (
      searchRef.current ??
      selectedOption ??
      listRef.current?.querySelector("button")
    )?.focus();

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function handleListKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const buttons = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>(
        'button[role="option"]',
      ) ?? [],
    );
    const current = buttons.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : event.key === "ArrowDown"
            ? (current + 1) % buttons.length
            : (current - 1 + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }

  return (
    <div className="relative" ref={rootRef}>
      <input name={name} type="hidden" value={value} />
      <button
        aria-controls={open ? listId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={ariaLabelledBy}
        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-[#111319] px-4 py-3 text-left text-sm text-white transition outline-none hover:border-white/20 focus-visible:border-emerald-400"
        onClick={() => {
          setQuery("");
          setOpen((current) => !current);
        }}
        ref={triggerRef}
        type="button"
      >
        <span
          className={`flex min-w-0 items-center gap-2 ${selected ? "text-white" : "text-slate-400"}`}
        >
          {showPersonIcon ? (
            <Icon className="size-4 shrink-0 text-emerald-300" name="person" />
          ) : renderOptionPrefix && selected ? (
            renderOptionPrefix(selected)
          ) : null}
          <span className="truncate">{selected?.label ?? placeholder}</span>
        </span>
        <Icon className="size-4 text-slate-400" name="chevronDown" />
      </button>
      {open ? (
        <div
          aria-labelledby={ariaLabelledBy}
          className="category-scroll absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-white/10 bg-[#191c21] p-1 shadow-2xl shadow-black/50"
          id={listId}
          onKeyDown={handleListKeyDown}
          ref={listRef}
          role="listbox"
        >
          {searchable ? (
            <div className="sticky top-0 z-10 bg-[#191c21] p-1 pb-2">
              <div className="relative">
                <Icon
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"
                  name="search"
                />
                <input
                  aria-label="Filtrar opções"
                  className="w-full rounded-lg border border-white/10 bg-[#111319] py-2 pr-3 pl-9 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => event.stopPropagation()}
                  placeholder="Digite para filtrar…"
                  ref={searchRef}
                  value={query}
                />
              </div>
            </div>
          ) : null}
          {filteredOptions.map((option) => (
            <button
              aria-selected={option.value === value}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                option.value === value
                  ? "bg-emerald-400/15 text-emerald-300"
                  : "text-slate-200 hover:bg-white/5 focus:bg-white/5"
              }`}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
                setQuery("");
                triggerRef.current?.focus();
              }}
              role="option"
              type="button"
            >
              {showPersonIcon ? (
                <Icon className="size-4 shrink-0" name="person" />
              ) : renderOptionPrefix ? (
                renderOptionPrefix(option)
              ) : null}
              <span className="truncate">{option.label}</span>
            </button>
          ))}
          {filteredOptions.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-slate-500">
              Nenhuma pessoa encontrada.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
