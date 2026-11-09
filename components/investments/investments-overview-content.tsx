"use client";

import { useState } from "react";

import { Icon } from "@/components/financial/icons";
import { InvestmentOverviewKpis } from "@/components/investments/investment-overview-kpis";
import { InvestmentProventsChart } from "@/components/investments/investment-provents-chart";
import { PortfolioEvolutionChart } from "@/components/investments/portfolio-evolution-chart";
import { PortfolioOverviewBoard } from "@/components/investments/portfolio-view";
import { PortfolioProductsBoard } from "@/components/investments/portfolio-products-board";
import type { PortfolioPosition } from "@/components/investments/portfolio-position-table";

type Month = { label: string; value: number };

export function InvestmentsOverviewContent({
  assets,
  currentAmount,
  institutions,
  investedAmount,
  months,
  portfolioEvolution,
  positions,
  usdBrl,
}: {
  assets: number;
  currentAmount: number;
  institutions: string[];
  investedAmount: number;
  months: Month[];
  portfolioEvolution: Record<"days" | "weeks" | "months" | "years", Month[]>;
  positions: PortfolioPosition[];
  usdBrl?: number;
}) {
  const [isValuesVisible, setValuesVisible] = useState(true);
  const currentValue = isValuesVisible
    ? new Intl.NumberFormat("pt-BR", {
        currency: "BRL",
        style: "currency",
      }).format(currentAmount)
    : "R$ ******";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-xs font-semibold tracking-[.16em] text-emerald-300 uppercase">
            Investimentos
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Visão geral</h1>
          <p className="mt-2 text-sm text-slate-400">
            Acompanhe sua carteira e mantenha seus produtos organizados.
          </p>
        </div>
        <div className="ml-auto w-fit text-left">
          <p className="text-sm text-slate-400">Patrimônio atual</p>
          <div className="mt-1 flex items-center gap-3">
            <p className="text-3xl font-semibold tabular-nums text-white">
              {currentValue}
            </p>
            <button
              aria-label={isValuesVisible ? "Ocultar valores" : "Mostrar valores"}
              className="flex flex-col items-center rounded-lg px-1.5 py-1 text-sky-300 transition hover:bg-sky-400/10 hover:text-sky-200"
              onClick={() => setValuesVisible((visible) => !visible)}
              title={isValuesVisible ? "Ocultar valores" : "Mostrar valores"}
              type="button"
            >
              <Icon className="size-6" name={isValuesVisible ? "eyeOff" : "eye"} />
              <span className="mt-0.5 text-[10px] font-semibold">
                {isValuesVisible ? "Ocultar" : "Exibir"}
              </span>
            </button>
          </div>
        </div>
      </div>
      <InvestmentOverviewKpis
        assets={assets}
        institutions={institutions.length}
        investedAmount={investedAmount}
        isValuesVisible={isValuesVisible}
      />
      {positions.length ? (
        <>
          <PortfolioOverviewBoard
            institutions={institutions}
            isValuesVisible={isValuesVisible}
            positions={positions}
            usdBrl={usdBrl}
          />
          <PortfolioProductsBoard
            isValuesVisible={isValuesVisible}
            positions={positions}
          />
        </>
      ) : null}
      <InvestmentProventsChart
        isValuesVisible={isValuesVisible}
        months={months}
      />
      <PortfolioEvolutionChart
        isValuesVisible={isValuesVisible}
        series={portfolioEvolution}
      />
    </>
  );
}
