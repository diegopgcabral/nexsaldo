import { PortfolioView } from "@/components/investments/portfolio-view";
import { createClient } from "@/lib/supabase/server";

export default async function InvestmentPortfolioPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  const [positionResult, assetResult, institutionResult, transactionResult] =
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
          supabase
            .from("investment_transactions")
            .select("asset_id, institution_id, transaction_date")
            .eq("user_id", userId)
            .order("transaction_date", { ascending: false }),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const assetsById = new Map(
    (assetResult.data ?? []).map((asset) => [asset.id, asset]),
  );
  const institutionsById = new Map(
    (institutionResult.data ?? []).map((institution) => [
      institution.id,
      institution.name,
    ]),
  );
  const institutionIdByAssetId = new Map<string, string>();
  for (const transaction of transactionResult.data ?? []) {
    if (
      transaction.institution_id &&
      !institutionIdByAssetId.has(transaction.asset_id)
    ) {
      institutionIdByAssetId.set(
        transaction.asset_id,
        transaction.institution_id,
      );
    }
  }
  const positions = (positionResult.data ?? []).flatMap((position) => {
    const asset = assetsById.get(position.asset_id);
    if (!asset) return [];
    const institutionId =
      asset.institution_id ?? institutionIdByAssetId.get(asset.id);
    return [
      {
        assetClass: asset.asset_class,
        institution: institutionId
          ? (institutionsById.get(institutionId) ?? "—")
          : "—",
        investedAmount: Number(position.invested_amount),
        name: asset.name,
        quantity: Number(position.quantity),
        ticker: asset.ticker?.startsWith("manual-") ? null : asset.ticker,
      },
    ];
  });

  return (
    <section>
      {positions.length ? (
        <PortfolioView positions={positions} />
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
