import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { FinancialShell } from "@/components/financial/financial-shell";
import {
  defaultNavigationModules,
  normalizeNavigationModules,
} from "@/lib/financial/navigation-modules";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function FinancialLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  let isAuthenticated = false;
  let displayName = "Usuário";
  let email: string | undefined;
  let cycleStartDay = 1;
  let navigationModules = defaultNavigationModules;

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims.sub;

    isAuthenticated = typeof userId === "string";
    email =
      typeof data?.claims.email === "string" ? data.claims.email : undefined;

    if (isAuthenticated) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, financial_cycle_start_day, navigation_modules")
        .eq("id", userId)
        .maybeSingle();
      displayName = profile?.display_name || email?.split("@")[0] || "Usuário";
      cycleStartDay = profile?.financial_cycle_start_day ?? 1;
      navigationModules = normalizeNavigationModules(
        profile?.navigation_modules,
      );
    }
  } catch {
    redirect("/login?error=configuration");
  }

  if (!isAuthenticated) {
    redirect("/login");
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#111319]" />}>
      <FinancialShell
        cycleStartDay={cycleStartDay}
        displayName={displayName}
        email={email}
        navigationModules={navigationModules}
      >
        {children}
      </FinancialShell>
    </Suspense>
  );
}
