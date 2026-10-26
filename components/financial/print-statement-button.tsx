"use client";

export function PrintStatementButton({
  fileName,
  floating = false,
}: {
  fileName: string;
  floating?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        const previousTitle = document.title;
        const restoreTitle = () => {
          document.title = previousTitle;
        };
        document.title = fileName;
        window.addEventListener("afterprint", restoreTitle, { once: true });
        window.print();
      }}
      className={
        floating
          ? "fixed right-6 bottom-6 z-10 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition-colors hover:bg-emerald-700 print:hidden"
          : "inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 print:hidden"
      }
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <path d="M6 14h12v7H6zM18 12h.01" />
      </svg>
      Imprimir
    </button>
  );
}
