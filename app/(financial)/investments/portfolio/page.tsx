import Link from "next/link";

import { PortfolioPositionTable } from "@/components/investments/portfolio-position-table";
import { createClient } from "@/lib/supabase/server";

const groups = [
  { assetClass: "STOCK", label: "Ações" },
  { assetClass: "FII", label: "FII · Fundo de Investimento Imobiliário" },
  { assetClass: "FIXED_INCOME", label: "Renda fixa" },
] as const;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(value);
}

type Props = { searchParams: Promise<{ imported?: string }> };

export default async function InvestmentPortfolioPage({ searchParams }: Props) {
  const { imported } = await searchParams;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  const [positionResult, assetResult, institutionResult] =
    typeof userId === "string"
      ? await Promise.all([
          supabase
            .from("investment_positions")
            .select("asset_id, quantity, invested_amount")
            .eq("user_id", userId),
          supabase
            .from("investment_assets")
            .select("id, name, ticker, asset_class, institution_id")
            .eq("user_id", userId),
          supabase
            .from("investment_institutions")
            .select("id, name")
            .eq("user_id", userId),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

  const assetsById = new Map(
    (assetResult.data ?? []).map((asset) => [asset.id, asset]),
  );
  const institutionsById = new Map(
    (institutionResult.data ?? []).map((institution) => [
      institution.id,
      institution.name,
    ]),
  );
  const positions = (positionResult.data ?? []).flatMap((position) => {
    const asset = assetsById.get(position.asset_id);
    if (!asset) return [];
    return [
      {
        assetClass: asset.asset_class,
        institution: asset.institution_id
          ? (institutionsById.get(asset.institution_id) ?? "—")
          : "—",
        investedAmount: Number(position.invested_amount),
        name: asset.name,
        quantity: Number(position.quantity),
        ticker: asset.ticker,
      },
    ];
  });

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[.16em] text-emerald-300 uppercase">
            Investimentos
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            Minha carteira
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Posições atualizadas a partir das negociações importadas.
          </p>
        </div>
        <Link
          className="inline-flex rounded-xl bg-[#00e599] px-5 py-2.5 text-sm font-semibold text-[#003822]"
          href="/investments/import?type=trades"
        >
          Importar negociações
        </Link>
      </div>

      {imported ? (
        <p className="rounded-xl bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
          {imported} negociações foram importadas com sucesso.
        </p>
      ) : null}

      {positions.length ? (
        <div className="space-y-8">
          {groups.map((group) => {
            const rows = positions.filter(
              (position) => position.assetClass === group.assetClass,
            );
            if (!rows.length) return null;
            const total = rows.reduce(
              (sum, row) => sum + row.investedAmount,
              0,
            );
            return (
              <section key={group.assetClass}>
                <div className="flex items-center justify-between gap-4 border-b border-emerald-400/45 pb-2 text-sm font-bold text-slate-100">
                  <h2>{group.label}</h2>
                  <span className="whitespace-nowrap">
                    TOTAL: {formatCurrency(total)}
                  </span>
                </div>
                <PortfolioPositionTable rows={rows} />
              </section>
            );
          })}
        </div>
      ) : (
        <section className="rounded-2xl bg-[#191c21] p-6">
          <h2 className="font-semibold text-white">
            Nenhuma posição importada
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Importe o relatório de negociação da B3 para montar sua carteira.
          </p>
        </section>
      )}
    </section>
  );
}
