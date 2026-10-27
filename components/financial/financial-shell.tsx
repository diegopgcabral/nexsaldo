"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { signOut } from "@/app/dashboard/actions";
import { FloatingCalculator } from "@/components/financial/floating-calculator";
import { Icon } from "@/components/financial/icons";
import { MonthSelector } from "@/components/financial/month-selector";
import { ToastProvider } from "@/components/financial/toast-provider";
import type { NavigationModules } from "@/lib/financial/navigation-modules";

type FinancialShellProps = {
  children: ReactNode;
  displayName: string;
  email?: string;
  cycleStartDay: number;
  navigationModules: NavigationModules;
};

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/income", label: "Receitas", icon: "income" },
  { href: "/expenses", label: "Despesas", icon: "expense" },
] as const;

export function FinancialShell({
  children,
  displayName,
  email,
  cycleStartDay,
  navigationModules,
}: FinancialShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const month = searchParams.get("month");
  const suffix = month ? `?month=${month}` : "";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#111319] text-[#e1e2ea]">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col justify-between border-r border-white/5 bg-[#0b0e13]/90 p-4 backdrop-blur-xl md:flex">
          <div>
            <Link className="flex px-1 py-1" href={`/dashboard${suffix}`}>
              <span
                className="relative h-10 w-40 overflow-hidden"
                aria-label="NexSaldo"
              >
                <Image
                  alt="NexSaldo"
                  className="scale-[1.6] object-cover"
                  fill
                  priority
                  sizes="160px"
                  src="/brand/nexsaldo-logo.png"
                />
              </span>
            </Link>
            <nav aria-label="Navegação principal" className="mt-8 space-y-1">
              {navigation.slice(0, 1).map((item) => {
                const isActive = pathname === item.href;

                return (
                  <Link
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                      isActive
                        ? "bg-emerald-400 text-[#003822] shadow-[0_0_20px_rgba(0,229,153,0.18)]"
                        : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                    }`}
                    href={`${item.href}${suffix}`}
                    key={item.href}
                  >
                    <Icon className="size-5" name={item.icon} />
                    {item.label}
                  </Link>
                );
              })}
              {navigationModules.transactions ? (
                <details
                  className="group"
                  open={pathname === "/income" || pathname === "/expenses"}
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-slate-100 [&::-webkit-details-marker]:hidden">
                    <Icon className="size-5" name="receipt" />
                    <span className="flex-1">Lançamentos</span>
                    <Icon
                      className="size-4 transition group-open:rotate-180"
                      name="chevronDown"
                    />
                  </summary>
                  <div className="mt-1 space-y-1 pl-7">
                    <SubmenuLink
                      active={pathname === "/income"}
                      href="/income"
                      icon="income"
                      label="Receitas"
                    />
                    <SubmenuLink
                      active={pathname === "/expenses"}
                      href="/expenses"
                      icon="expense"
                      label="Despesas"
                    />
                  </div>
                </details>
              ) : null}
              {navigationModules.creditCards ? (
                <details
                  className="group"
                  open={
                    pathname.startsWith("/cards") ||
                    pathname.startsWith("/invoices") ||
                    pathname.startsWith("/reconciliation") ||
                    pathname.startsWith("/participants") ||
                    pathname.startsWith("/account-division")
                  }
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-slate-100 [&::-webkit-details-marker]:hidden">
                    <Icon className="size-5" name="creditCard" />
                    <span className="flex-1">Cartões de crédito</span>
                    <Icon
                      className="size-4 transition group-open:rotate-180"
                      name="chevronDown"
                    />
                  </summary>
                  <div className="mt-1 space-y-1 pl-7">
                    <SubmenuLink
                      active={pathname === "/cards"}
                      href="/cards"
                      icon="creditCard"
                      label="Meus cartões"
                    />
                    <SubmenuLink
                      active={pathname.startsWith("/participants")}
                      href="/participants"
                      icon="person"
                      label="Participantes"
                    />
                    <SubmenuLink
                      active={pathname.startsWith("/invoices")}
                      href="/invoices"
                      icon="receipt"
                      label="Faturas"
                    />
                    <SubmenuLink
                      active={pathname === "/reconciliation"}
                      href="/reconciliation"
                      icon="check"
                      label="Conciliação"
                    />
                    <div>
                      <div className="space-y-1">
                        <SubmenuLink
                          active={pathname.startsWith("/account-division")}
                          href="/account-division"
                          icon="calculator"
                          label="Divisão de contas"
                        />
                      </div>
                    </div>
                  </div>
                </details>
              ) : null}
              {navigationModules.investments ? (
                <details open={pathname.startsWith("/investments")}>
                  <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-slate-100">
                    <span className="flex items-center gap-3"><Icon className="size-5" name="briefcase" />Investimentos</span>
                    <Icon className="size-4 transition group-open:rotate-180" name="chevronDown" />
                  </summary>
                  <div className="mt-1 space-y-1 pl-7">
                    <SubmenuLink active={pathname === "/investments"} href="/investments" icon="dashboard" label="Dashboard" />
                    <SubmenuLink active={pathname.startsWith("/investments/portfolio")} href="/investments/portfolio" icon="wallet" label="Minha carteira" />
                    <SubmenuLink active={pathname.startsWith("/investments/import")} href="/investments/import" icon="archive" label="Importação" />
                    <SubmenuLink active={pathname.startsWith("/investments/provents")} href="/investments/provents" icon="money" label="Proventos" />
                  </div>
                </details>
              ) : null}
              <Link
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                  pathname === "/settings"
                    ? "bg-emerald-400 text-[#003822] shadow-[0_0_20px_rgba(0,229,153,0.18)]"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                }`}
                href="/settings"
              >
                <Icon className="size-5" name="settings" />
                Configurações
              </Link>
            </nav>
          </div>

          <div className="rounded-xl bg-[#1d2025]/70 p-3">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#32353b] text-xs font-bold text-emerald-300">
                {initials || "G"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {displayName}
                </p>
                {email ? (
                  <p className="truncate text-xs text-slate-400">{email}</p>
                ) : null}
              </div>
              <form action={signOut}>
                <button
                  aria-label="Sair da conta"
                  className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-red-300"
                  type="submit"
                >
                  <Icon className="size-4" name="logout" />
                </button>
              </form>
            </div>
          </div>
        </aside>

        <div className="min-h-screen md:pl-64">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/5 bg-[#111319]/85 px-4 backdrop-blur-xl sm:px-6">
            <div>
              <p className="text-sm font-semibold text-white">
                Olá, {displayName}
              </p>
              <p className="hidden text-xs text-slate-400 sm:block">
                Sua organização financeira pessoal
              </p>
            </div>
            <MonthSelector cycleStartDay={cycleStartDay} />
          </header>
          <main className="relative min-h-[calc(100vh-4rem)] px-4 py-8 pb-24 sm:px-6 md:pb-8 lg:px-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 left-1/4 size-96 rounded-full bg-emerald-400/5 blur-[110px]"
            />
            <div className="relative mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>

        <nav
          aria-label="Navegação móvel"
          className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-white/5 bg-[#0b0e13]/95 px-1 backdrop-blur-xl md:hidden"
        >
          {[
            navigation[0],
            ...(navigationModules.transactions
              ? [
                  {
                    href: "/income",
                    label: "Lançamentos",
                    icon: "receipt" as const,
                  },
                ]
              : []),
            ...(navigationModules.creditCards
              ? [
                  {
                    href: "/cards",
                    label: "Cartões",
                    icon: "creditCard" as const,
                  },
                ]
              : []),
            ...(navigationModules.investments
              ? [
                  {
                    href: "/investments",
                    label: "Investir",
                    icon: "briefcase" as const,
                  },
                ]
              : []),
            { href: "/settings", label: "Ajustes", icon: "settings" as const },
          ].map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href === "/cards" &&
                (pathname === "/participants" ||
                  pathname.startsWith("/invoices") ||
                  pathname.startsWith("/reconciliation") ||
                  pathname.startsWith("/account-division")));

            return (
              <Link
                className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-1 text-[10px] font-medium transition ${
                  isActive ? "text-emerald-400" : "text-slate-500"
                }`}
                href={`${item.href}${suffix}`}
                key={item.href}
              >
                <Icon className="size-5" name={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <FloatingCalculator />
      </div>
    </ToastProvider>
  );
}

function SubmenuLink({
  active,
  href,
  icon,
  label,
}: {
  active: boolean;
  href: string;
  icon:
    | "archive"
    | "calculator"
    | "check"
    | "creditCard"
    | "dashboard"
    | "expense"
    | "income"
    | "money"
    | "person"
    | "receipt"
    | "briefcase"
    | "wallet";
  label: string;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm transition ${active ? "bg-emerald-400 text-[#003822]" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
      href={href}
    >
      <Icon className="size-4" name={icon} />
      {label}
    </Link>
  );
}
