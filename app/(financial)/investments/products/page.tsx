import { ProductTypeList } from "@/components/investments/product-type-list";
import { createClient } from "@/lib/supabase/server";

export default async function InvestmentProductsPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  const [assetsResult, productTypesResult] =
    typeof userId === "string"
      ? await Promise.all([
          supabase
            .from("investment_assets")
            .select("asset_class")
            .eq("user_id", userId),
          supabase
            .from("investment_product_types")
            .select("asset_class, is_active")
            .eq("user_id", userId),
        ])
      : [{ data: [] }, { data: [] }];

  return (
    <ProductTypeList
      assetClasses={
        Array.isArray(assetsResult.data)
          ? assetsResult.data.map((asset) => asset.asset_class)
          : []
      }
      productTypes={
        Array.isArray(productTypesResult.data) ? productTypesResult.data : []
      }
    />
  );
}
