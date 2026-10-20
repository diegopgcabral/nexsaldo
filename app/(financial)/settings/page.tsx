import { FinancialCycleSettings } from "@/components/financial/financial-cycle-settings";
import { ExpenseCategorySettings } from "@/components/financial/expense-category-settings";
import { NavigationModuleSettings } from "@/components/financial/navigation-module-settings";
import { normalizeNavigationModules } from "@/lib/financial/navigation-modules";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  const { data: profile } =
    typeof userId === "string"
      ? await supabase
          .from("profiles")
          .select("financial_cycle_start_day, navigation_modules")
          .eq("id", userId)
          .maybeSingle()
      : { data: null };
  const { data: categories } =
    typeof userId === "string"
      ? await supabase
          .from("expense_categories")
          .select("id, name, icon_key, is_active")
          .eq("user_id", userId)
          .order("is_active", { ascending: false })
          .order("name")
      : { data: [] };
  return (
    <div className="space-y-6">
      <NavigationModuleSettings
        modules={normalizeNavigationModules(profile?.navigation_modules)}
      />
      <FinancialCycleSettings
        initialDay={profile?.financial_cycle_start_day ?? 1}
      />
      <ExpenseCategorySettings categories={categories ?? []} />
    </div>
  );
}
