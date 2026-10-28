import { InstitutionManager } from "@/components/investments/institution-manager";
import { createClient } from "@/lib/supabase/server";

export default async function InvestmentInstitutionsPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  const { data: institutions } =
    typeof userId === "string"
      ? await supabase
          .from("investment_institutions")
          .select("id, name")
          .eq("user_id", userId)
          .order("name")
      : { data: [] };

  return <InstitutionManager institutions={institutions ?? []} />;
}
