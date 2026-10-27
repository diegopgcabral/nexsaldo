import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

const groups = [
  { assetClass: "STOCK", label: "Ações", typeLabel: "ON / PN / UNIT" },
  {
    assetClass: "FII",
    label: "FII · Fundo de Investimento Imobiliário",
    typeLabel: "Cotas",
  },
  { assetClass: "FIXED_INCOME", label: "Renda fixa", typeLabel: "Título" },
] as const;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(value);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 8 }).format(
    value,
  );
}

function assetType(assetClass: string, ticker: string | null) {
  if (assetClass === "FII") return "Cotas";
  if (assetClass === "FIXED_INCOME") return "Título";
  if (ticker?.endsWith("3")) return "ON";
  if (ticker?.endsWith("4")) return "PN";
  if (ticker?.endsWith("11")) return "UNIT";
  return "—";
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
            .select("asset_id, quantity, invested_amount, current_amount")
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
            const rows = positions
              .filter((position) => position.assetClass === group.assetClass)
              .sort((first, second) =>
                (first.ticker ?? first.name).localeCompare(
                  second.ticker ?? second.name,
                ),
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
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] table-fixed text-left text-sm">
                    <colgroup>
                      <col className="w-[34%]" />
                      <col className="w-[12%]" />
                      <col className="w-[22%]" />
                      <col className="w-[11%]" />
                      <col className="w-[11%]" />
                      <col className="w-[12%]" />
                    </colgroup>
                    <thead className="border-b border-white/8 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                      <tr>
                        <th className="px-3 py-3">Produto</th>
                        <th className="px-3 py-3">Tipo</th>
                        <th className="px-3 py-3">Instituição</th>
                        <th className="px-3 py-3 text-right">Quantidade</th>
                        <th className="px-3 py-3 text-right">Preço médio</th>
                        <th className="px-3 py-3 text-right">
                          Valor investido
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/6">
                      {rows.map((row) => (
                        <tr key={`${row.assetClass}:${row.ticker ?? row.name}`}>
                          <td className="truncate px-3 py-3 font-medium text-white">
                            {row.ticker ?? row.name}
                          </td>
                          <td className="px-3 py-3 text-slate-400">
                            {assetType(row.assetClass, row.ticker)}
                          </td>
                          <td className="truncate px-3 py-3 text-slate-400">
                            {row.institution}
                          </td>
                          <td className="px-3 py-3 text-right text-slate-200 tabular-nums">
                            {formatQuantity(row.quantity)}
                          </td>
                          <td className="px-3 py-3 text-right text-slate-200 tabular-nums">
                            {formatCurrency(row.investedAmount / row.quantity)}
                          </td>
                          <td className="px-3 py-3 text-right text-slate-200 tabular-nums">
                            {formatCurrency(row.investedAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
