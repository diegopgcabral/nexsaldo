import { ProductManager } from "@/components/investments/product-manager";
import { createClient } from "@/lib/supabase/server";

export default async function InvestmentProductsPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  const [institutionsResult, assetsResult, positionsResult] =
    typeof userId === "string"
      ? await Promise.all([
          supabase
            .from("investment_institutions")
            .select("id, name")
            .eq("user_id", userId)
            .order("name"),
          supabase
            .from("investment_assets")
            .select("id, name, ticker, asset_class, institution_id")
            .eq("user_id", userId)
            .order("asset_class")
            .order("name"),
          supabase
            .from("investment_positions")
            .select("asset_id, quantity, invested_amount, current_amount, maturity_date")
            .eq("user_id", userId),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];
  const positionsByAssetId = new Map(
    (positionsResult.data ?? []).map((position) => [position.asset_id, position]),
  );
  const products = (assetsResult.data ?? []).map((asset) => ({
    ...asset,
    currentAmount: Number(positionsByAssetId.get(asset.id)?.current_amount ?? 0),
    investedAmount: Number(positionsByAssetId.get(asset.id)?.invested_amount ?? 0),
    maturityDate: positionsByAssetId.get(asset.id)?.maturity_date ?? null,
    quantity: Number(positionsByAssetId.get(asset.id)?.quantity ?? 1),
  }));

  return <ProductManager institutions={institutionsResult.data ?? []} products={products} />;
}
