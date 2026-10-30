import { PortfolioView } from "@/components/investments/portfolio-view";
import { investmentAssetName } from "@/lib/investments/asset-catalog";
import { createClient } from "@/lib/supabase/server";

export default async function InvestmentPortfolioPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  const [
    positionResult,
    assetResult,
    institutionResult,
    transactionResult,
    productTypesResult,
  ] =
    typeof userId === "string"
      ? await Promise.all([
          supabase
            .from("investment_positions")
            .select("asset_id, quantity, invested_amount, current_amount, maturity_date")
            .eq("user_id", userId),
          supabase
            .from("investment_assets")
            .select("id, name, display_name, ticker, asset_class, fixed_income_subtype, institution_id")
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
          supabase
            .from("investment_product_types")
            .select("asset_class, is_active")
            .eq("user_id", userId),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

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
        assetId: asset.id,
        assetClass: asset.asset_class,
        displayName: asset.display_name,
        fixedIncomeSubtype: asset.fixed_income_subtype,
        institution: institutionId
          ? (institutionsById.get(institutionId) ?? "—")
          : "—",
        investedAmount: Number(position.invested_amount),
        currentAmount: Number(position.current_amount),
        maturityDate: position.maturity_date,
        name: asset.name,
        quantity: Number(position.quantity),
        ticker: asset.ticker?.startsWith("manual-") ? null : asset.ticker,
      },
    ];
  });

  const productTypes = new Set<string>(["FIXED_INCOME", "STOCK", "FII"]);
  for (const productType of productTypesResult.data ?? []) {
    if (productType.is_active) productTypes.add(productType.asset_class);
    else productTypes.delete(productType.asset_class);
  }

  return (
    <section>
      {positions.length || productTypes.size ? (
        <PortfolioView
          assets={(assetResult.data ?? []).flatMap((asset) =>
            asset.ticker && !asset.ticker.startsWith("manual-")
              ? [
                  {
                    assetClass: asset.asset_class,
                    name: investmentAssetName(
                      asset.ticker,
                      asset.name,
                      asset.display_name,
                    ),
                    ticker: asset.ticker,
                  },
                ]
              : [],
          )}
          institutions={(institutionResult.data ?? []).map((institution) => ({
            id: institution.id,
            name: institution.name,
          }))}
          positions={positions}
          productTypes={[...productTypes]}
        />
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
