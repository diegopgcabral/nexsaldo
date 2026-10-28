import { ProductTypeList } from "@/components/investments/product-type-list";
import { createClient } from "@/lib/supabase/server";

export default async function InvestmentProductsPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  const { data: assets } =
    typeof userId === "string"
      ? await supabase
          .from("investment_assets")
          .select("asset_class")
          .eq("user_id", userId)
      : { data: [] };

  return (
    <ProductTypeList
      assetClasses={(assets ?? []).map((asset) => asset.asset_class)}
    />
  );
}
