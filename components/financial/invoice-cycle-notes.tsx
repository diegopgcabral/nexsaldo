"use client";

import { useState, useTransition } from "react";

import {
  deleteInvoiceCycleNote,
  saveInvoiceCycleNote,
  setInvoiceCycleNoteCompleted,
} from "@/app/(financial)/invoices/actions";
import { Icon } from "@/components/financial/icons";
import { useToast } from "@/components/financial/toast-provider";
import type {
  InvoiceCycleNote,
  InvoiceNoteChecklistItem,
} from "@/lib/financial/invoice-note";

function formatText(value: string) {
  return value
    .split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)]+\))/g)
    .map((part, index) => {
      const bold = /^\*\*([^*]+)\*\*$/.exec(part);
      const link = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/.exec(part);
      if (bold) return <strong key={index}>{bold[1]}</strong>;
      if (link)
        return (
          <a
            className="text-emerald-300 underline"
            href={link[2]}
            key={index}
            rel="noreferrer"
            target="_blank"
          >
            {link[1]}
          </a>
        );
      return part;
    });
}

export function InvoiceCycleNotes({
  cardId,
  month,
  notes,
}: {
  cardId: string;
  month: string;
  notes: InvoiceCycleNote[];
}) {
  const { notify } = useToast();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<InvoiceCycleNote | null | "new">(null);
  const openNotes = notes.filter((note) => !note.isCompleted);
  const completedNotes = notes.filter((note) => note.isCompleted);

  function complete(note: InvoiceCycleNote, value: boolean) {
    startTransition(async () => {
      const result = await setInvoiceCycleNoteCompleted({
        id: note.id,
        cardId,
        completed: value,
      });
      if (result.error) notify("error", result.error);
      else notify("success", value ? "Nota finalizada." : "Nota reaberta.");
    });
  }
  function remove(note: InvoiceCycleNote) {
    startTransition(async () => {
      const result = await deleteInvoiceCycleNote({ id: note.id, cardId });
      if (result.error) notify("error", result.error);
      else notify("success", "Nota excluída.");
    });
  }
  return (
    <section className="rounded-2xl border border-white/5 bg-[#1d2026] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-white">Notas do ciclo</h2>
          <p className="mt-1 text-xs text-slate-400">
            Anotações privadas desta fatura.
          </p>
        </div>
        <button
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-400/15 px-3 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-400/25"
          onClick={() => setEditing("new")}
          type="button"
        >
          <Icon className="size-4" name="plus" /> Nova nota
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {openNotes.length ? (
          openNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onComplete={() => complete(note, true)}
              onDelete={() => remove(note)}
              onEdit={() => setEditing(note)}
            />
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-sm text-slate-400">
            Nenhuma nota em aberto neste ciclo.
          </p>
        )}
      </div>
      {completedNotes.length ? (
        <details className="mt-4 rounded-xl border border-white/5 bg-[#111319]">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-300">
            Concluídas ({completedNotes.length})
          </summary>
          <div className="space-y-3 border-t border-white/5 p-3">
            {completedNotes.map((note) => (
              <NoteCard
                completed
                key={note.id}
                note={note}
                onComplete={() => complete(note, false)}
                onDelete={() => remove(note)}
                onEdit={() => setEditing(note)}
              />
            ))}
          </div>
        </details>
      ) : null}
      {editing ? (
        <NoteEditor
          cardId={cardId}
          month={month}
          note={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </section>
  );
}

function NoteCard({
  note,
  completed,
  onComplete,
  onEdit,
  onDelete,
}: {
  note: InvoiceCycleNote;
  completed?: boolean;
  onComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      className={`rounded-xl border p-4 ${completed ? "border-white/5 bg-white/[0.02] opacity-75" : "border-white/5 bg-[#111319]"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 text-sm leading-6 whitespace-pre-wrap text-slate-200">
          {formatText(note.content)}
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            aria-label="Editar nota"
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
            onClick={onEdit}
            type="button"
          >
            <Icon className="size-4" name="edit" />
          </button>
          <button
            aria-label="Excluir nota"
            className="rounded-md p-1.5 text-slate-400 hover:bg-red-400/10 hover:text-red-200"
            onClick={onDelete}
            type="button"
          >
            <Icon className="size-4" name="trash" />
          </button>
        </div>
      </div>
      {note.checklist.length ? (
        <div className="mt-3 space-y-1.5 border-t border-white/5 pt-3">
          {note.checklist.map((item) => (
            <p
              className={`text-sm ${item.checked ? "text-slate-500 line-through" : "text-slate-300"}`}
              key={item.id}
            >
              ✓ {item.text}
            </p>
          ))}
        </div>
      ) : null}
      <button
        className={`mt-3 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${completed ? "bg-white/5 text-slate-300" : "bg-emerald-400/15 text-emerald-300"}`}
        onClick={onComplete}
        type="button"
      >
        {completed ? "Reabrir" : "Finalizar"}
      </button>
    </article>
  );
}

function NoteEditor({
  cardId,
  month,
  note,
  onClose,
}: {
  cardId: string;
  month: string;
  note?: InvoiceCycleNote;
  onClose: () => void;
}) {
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [content, setContent] = useState(note?.content ?? "");
  const [checklist, setChecklist] = useState<InvoiceNoteChecklistItem[]>(
    note?.checklist ?? [],
  );
  function wrap(prefix: string, suffix = prefix) {
    const field = document.getElementById(
      "invoice-note-content",
    ) as HTMLTextAreaElement | null;
    if (!field) return;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const value = field.value;
    setContent(
      `${value.slice(0, start)}${prefix}${value.slice(start, end) || "texto"}${suffix}${value.slice(end)}`,
    );
    field.focus();
  }
  function save() {
    startTransition(async () => {
      const result = await saveInvoiceCycleNote({
        id: note?.id,
        cardId,
        month,
        content,
        checklist,
      });
      if (result.error) notify("error", result.error);
      else {
        notify("success", "Nota salva.");
        onClose();
      }
    });
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#1d2026] p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">
            {note ? "Editar nota" : "Nova nota"}
          </h3>
          <button
            aria-label="Fechar"
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10"
            onClick={onClose}
            type="button"
          >
            <Icon className="size-4" name="close" />
          </button>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            className="rounded bg-white/10 px-2 py-1 text-sm font-bold"
            onClick={() => wrap("**")}
            type="button"
          >
            B
          </button>
          <button
            className="rounded bg-white/10 px-2 py-1 text-sm"
            onClick={() => wrap("[", "](https://)")}
            type="button"
          >
            Link
          </button>
          <button
            className="rounded bg-white/10 px-2 py-1 text-sm"
            onClick={() =>
              setChecklist((items) => [
                ...items,
                { id: crypto.randomUUID(), text: "", checked: false },
              ])
            }
            type="button"
          >
            Checklist
          </button>
        </div>
        <textarea
          className="mt-3 min-h-36 w-full rounded-xl border border-white/10 bg-[#111319] p-3 text-sm text-white outline-none focus:border-emerald-400"
          id="invoice-note-content"
          maxLength={10000}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Escreva sua anotação…"
          value={content}
        />
        {checklist.map((item, index) => (
          <div className="mt-2 flex gap-2" key={item.id}>
            <input
              checked={item.checked}
              onChange={(event) =>
                setChecklist((items) =>
                  items.map((current, position) =>
                    position === index
                      ? { ...current, checked: event.target.checked }
                      : current,
                  ),
                )
              }
              type="checkbox"
            />
            <input
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#111319] px-3 py-2 text-sm text-white"
              onChange={(event) =>
                setChecklist((items) =>
                  items.map((current, position) =>
                    position === index
                      ? { ...current, text: event.target.value }
                      : current,
                  ),
                )
              }
              placeholder="Item da checklist"
              value={item.text}
            />
            <button
              className="text-slate-400 hover:text-red-200"
              onClick={() =>
                setChecklist((items) =>
                  items.filter((_, position) => position !== index),
                )
              }
              type="button"
            >
              <Icon className="size-4" name="trash" />
            </button>
          </div>
        ))}
        <div className="mt-5 flex justify-end gap-2">
          <button
            className="rounded-lg px-4 py-2 text-sm text-slate-300"
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-[#003822] disabled:opacity-50"
            disabled={pending}
            onClick={save}
            type="button"
          >
            {pending ? "Salvando…" : "Salvar nota"}
          </button>
        </div>
      </div>
    </div>
  );
}
