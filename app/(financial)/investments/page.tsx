import { createInvestmentAsset, createInvestmentInstitution } from "@/app/(financial)/investments/actions";
import { createClient } from "@/lib/supabase/server";

const labels = { FIXED_INCOME: "Renda fixa", STOCK: "Ações", FII: "FIIs", US_ETF: "ETFs americanos", CRYPTO: "Cripto" } as const;

export default async function InvestmentsPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  const { data: institutions } = typeof userId === "string" ? await supabase.from("investment_institutions").select("id, name").eq("user_id", userId).order("name") : { data: [] };
  const { data: assets } = typeof userId === "string" ? await supabase.from("investment_assets").select("id, name, ticker, asset_class").eq("user_id", userId).order("name") : { data: [] };
  return (
    <section className="space-y-6">
      <div><p className="text-xs font-semibold tracking-[.16em] text-emerald-300 uppercase">Minha carteira</p><h1 className="mt-2 text-3xl font-semibold text-white">Investimentos</h1><p className="mt-2 text-sm text-slate-400">Cadastre instituições e produtos. Aportes e posição entram na próxima etapa.</p></div>
      <div className="grid gap-6 lg:grid-cols-2">
        <form action={createInvestmentInstitution} className="rounded-2xl bg-[#191c21] p-5"><h2 className="font-semibold text-white">Instituição</h2><div className="mt-4 flex gap-2"><input className="income-input" name="name" placeholder="Ex.: XP Investimentos" required /><button className="rounded-xl bg-[#00e599] px-4 text-sm font-semibold text-[#003822]">Adicionar</button></div></form>
        <form action={createInvestmentAsset} className="rounded-2xl bg-[#191c21] p-5"><h2 className="font-semibold text-white">Produto</h2><div className="mt-4 grid gap-3"><input className="income-input" name="name" placeholder="Ex.: Tesouro Selic 2029" required /><input className="income-input" name="ticker" placeholder="Código opcional, ex.: IVVB11" /><select className="income-input" name="assetClass">{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select className="income-input" name="institutionId" defaultValue=""><option value="">Sem instituição definida</option>{institutions?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="rounded-xl bg-[#00e599] px-4 py-2.5 text-sm font-semibold text-[#003822]">Cadastrar produto</button></div></form>
      </div>
      <section className="rounded-2xl bg-[#191c21] p-5"><h2 className="font-semibold text-white">Produtos cadastrados</h2>{assets?.length ? <div className="mt-4 divide-y divide-white/5">{assets.map((item) => <div className="flex justify-between gap-4 py-3 text-sm" key={item.id}><span className="font-medium text-white">{item.ticker ? `${item.ticker} · ` : ""}{item.name}</span><span className="text-slate-400">{labels[item.asset_class as keyof typeof labels]}</span></div>)}</div> : <p className="mt-3 text-sm text-slate-400">Nenhum produto cadastrado.</p>}</section>
    </section>
  );
}
