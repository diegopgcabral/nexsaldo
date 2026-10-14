"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Icon } from "@/components/financial/icons";

type DarkSelectOption = { value: string; label: string };

type DarkSelectProps = {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly DarkSelectOption[];
  placeholder: string;
  ariaLabelledBy: string;
};

export function DarkSelect({
  name,
  value,
  onChange,
  options,
  placeholder,
  ariaLabelledBy,
}: DarkSelectProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;

    const selectedOption = listRef.current?.querySelector<HTMLButtonElement>(
      '[aria-selected="true"]',
    );
    (selectedOption ?? listRef.current?.querySelector("button"))?.focus();

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
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
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        <span className={selected ? "text-white" : "text-slate-400"}>
          {selected?.label ?? placeholder}
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
          {options.map((option) => (
            <button
              aria-selected={option.value === value}
              className={`block w-full rounded-lg px-3 py-2.5 text-left text-sm transition ${
                option.value === value
                  ? "bg-emerald-400/15 text-emerald-300"
                  : "text-slate-200 hover:bg-white/5 focus:bg-white/5"
              }`}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
                triggerRef.current?.focus();
              }}
              role="option"
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
