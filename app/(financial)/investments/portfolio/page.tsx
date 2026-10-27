import Link from "next/link";

export default function InvestmentPortfolioPage() {
  return <section className="rounded-2xl bg-[#191c21] p-6"><p className="text-xs font-semibold tracking-[.16em] text-emerald-300 uppercase">Investimentos</p><h1 className="mt-2 text-3xl font-semibold text-white">Minha carteira</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">As posições aparecerão aqui agrupadas por tipo de produto, como Tesouro Direto, FIIs, Ações e ETFs americanos.</p><Link className="mt-5 inline-flex rounded-xl bg-[#00e599] px-5 py-2.5 text-sm font-semibold text-[#003822]" href="/investments/import">Importar relatório B3</Link></section>;
}
