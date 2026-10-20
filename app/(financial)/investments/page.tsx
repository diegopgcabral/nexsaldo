import { Icon } from "@/components/financial/icons";

export default function InvestmentsPage() {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-[#191c21] p-6 shadow-xl shadow-black/20 sm:p-8">
      <div
        aria-hidden="true"
        className="absolute -top-20 -right-20 size-72 rounded-full bg-emerald-400/10 blur-3xl"
      />
      <div className="relative max-w-2xl">
        <span className="flex size-12 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
          <Icon className="size-6" name="briefcase" />
        </span>
        <p className="mt-6 text-xs font-semibold tracking-[0.16em] text-emerald-300 uppercase">
          Em breve
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
          Investimentos
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Este módulo será o espaço para acompanhar aportes, carteira e a
          evolução dos seus investimentos.
        </p>
      </div>
    </section>
  );
}
