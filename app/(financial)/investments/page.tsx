import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

const labels = {
  FIXED_INCOME: "Renda fixa",
  STOCK: "Ações",
  FII: "FIIs",
  US_ETF: "ETFs americanos",
  BRAZILIAN_ETF: "ETFs brasileiros",
  BDR: "BDRs",
  FUND: "Fundos de investimento",
  PENSION: "Previdência",
  CASH_BOX: "Caixinhas",
  CRYPTO: "Cripto",
} as const;

export default async function InvestmentsPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  const [assetsResult, institutionsResult, positionsResult] =
    typeof userId === "string"
      ? await Promise.all([
          supabase
            .from("investment_assets")
            .select("asset_class")
            .eq("user_id", userId),
          supabase
            .from("investment_institutions")
            .select("id")
            .eq("user_id", userId),
          supabase
            .from("investment_positions")
            .select("invested_amount")
            .eq("user_id", userId),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];
  const investedAmount = (positionsResult.data ?? []).reduce(
    (sum, position) => sum + Number(position.invested_amount),
    0,
  );
  const assetTypes = new Set(
    assetsResult.data?.map((asset) => asset.asset_class),
  );

  return (
    <section className="space-y-8">
      <div>
        <p className="text-xs font-semibold tracking-[.16em] text-emerald-300 uppercase">
          Investimentos
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-400">
          Acompanhe sua carteira e mantenha seus produtos organizados.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Valor investido"
          value={formatCurrency(investedAmount)}
        />
        <SummaryCard
          label="Ativos cadastrados"
          value={String(assetsResult.data?.length ?? 0)}
        />
        <SummaryCard
          label="Instituições"
          value={String(institutionsResult.data?.length ?? 0)}
        />
      </div>
      {assetTypes.size ? (
        <section className="rounded-2xl bg-[#191c21] p-5">
          <h2 className="font-semibold text-white">Composição da carteira</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {[...assetTypes].map((assetClass) => (
              <span
                className="rounded-lg bg-emerald-400/10 px-3 py-1.5 text-sm text-emerald-200"
                key={assetClass}
              >
                {labels[assetClass as keyof typeof labels]}
              </span>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-emerald-400/25 bg-[#191c21] p-6">
          <h2 className="font-semibold text-white">Comece sua carteira</h2>
          <p className="mt-2 text-sm text-slate-400">
            Importe negociações da B3 ou cadastre manualmente CDBs e ETFs
            americanos.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              className="rounded-xl bg-[#00e599] px-4 py-2.5 text-sm font-semibold text-[#003822]"
              href="/investments/import"
            >
              Importar B3
            </Link>
            <Link
              className="rounded-xl border border-white/12 px-4 py-2.5 text-sm font-semibold text-slate-200"
              href="/investments/products"
            >
              Cadastrar produto
            </Link>
          </div>
        </section>
      )}
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-2xl bg-[#191c21] p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </section>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(value);
}
