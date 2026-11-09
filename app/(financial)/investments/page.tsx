import Link from "next/link";

import { InvestmentsOverviewContent } from "@/components/investments/investments-overview-content";
import { fetchBrapiQuote } from "@/lib/investments/brapi";
import { fetchTwelveDataQuote } from "@/lib/investments/twelve-data";
import { createClient } from "@/lib/supabase/server";

function previousTwelveMonths() {
  const current = new Date();
  const currentMonth = new Date(
    Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1),
  );

  return Array.from({ length: 12 }, (_, index) => {
    const month = new Date(currentMonth);
    month.setUTCMonth(currentMonth.getUTCMonth() - (11 - index));
    return month.toISOString().slice(0, 7);
  });
}

function monthLabel(month: string) {
  const date = new Date(`${month}-01T12:00:00Z`);
  const shortMonth = new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    timeZone: "UTC",
  })
    .format(date)
    .replace(".", "")
    .toUpperCase();
  return `${shortMonth} ${String(date.getUTCFullYear()).slice(-2)}`;
}

export default async function InvestmentsPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  const monthReferences = previousTwelveMonths();
  const [assetsResult, institutionsResult, positionsResult, transactionsResult, proventsResult] =
    typeof userId === "string"
      ? await Promise.all([
          supabase
            .from("investment_assets")
            .select("id, name, fixed_income_subtype, asset_class, institution_id, ticker")
            .eq("user_id", userId),
          supabase
            .from("investment_institutions")
            .select("id, name")
            .eq("user_id", userId),
          supabase
            .from("investment_positions")
            .select("asset_id, invested_amount, current_amount, quantity")
            .eq("user_id", userId),
          supabase
            .from("investment_transactions")
            .select("asset_id, institution_id, quantity, total_amount, transaction_date, transaction_type")
            .eq("user_id", userId)
            .order("transaction_date", { ascending: false }),
          supabase
            .from("investment_provents")
            .select("amount, currency, received_on")
            .eq("user_id", userId)
            .gte("received_on", `${monthReferences[0]}-01`),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const assetTypes = new Set(
    assetsResult.data?.map((asset) => asset.asset_class),
  );
  let usdBrl = 0;
  try {
    usdBrl = (await fetchTwelveDataQuote("USD/BRL")).price;
  } catch {
    /* The board keeps the US-dollar amount visible if the current FX quote is unavailable. */
  }
  const proventsByMonth = new Map(monthReferences.map((month) => [month, 0]));
  for (const provent of proventsResult.data ?? []) {
    const month = provent.received_on.slice(0, 7);
    if (!proventsByMonth.has(month)) continue;
    const amount = Number(provent.amount);
    const value = provent.currency === "USD" ? amount * usdBrl : amount;
    proventsByMonth.set(month, (proventsByMonth.get(month) ?? 0) + value);
  }
  const proventsMonths = monthReferences.map((month) => ({
    label: monthLabel(month),
    value: proventsByMonth.get(month) ?? 0,
  }));
  const assetsById = new Map(
    (assetsResult.data ?? []).map((asset) => [asset.id, asset]),
  );
  const institutionsById = new Map(
    (institutionsResult.data ?? []).map((institution) => [
      institution.id,
      institution.name,
    ]),
  );
  const institutionIdByAssetId = new Map<string, string>();
  for (const transaction of transactionsResult.data ?? []) {
    if (
      transaction.institution_id &&
      !institutionIdByAssetId.has(transaction.asset_id)
    ) {
      institutionIdByAssetId.set(transaction.asset_id, transaction.institution_id);
    }
  }
  const liveQuotes = await Promise.all(
    (positionsResult.data ?? []).map(async (position) => {
      const asset = assetsById.get(position.asset_id);
      if (!asset?.ticker || asset.ticker.startsWith("manual-")) return null;
      try {
        const quote =
          asset.asset_class === "US_ETF"
            ? await fetchTwelveDataQuote(asset.ticker)
            : asset.asset_class === "STOCK" || asset.asset_class === "FII"
              ? await fetchBrapiQuote(asset.ticker)
              : null;
        return quote ? { assetId: asset.id, price: quote.price } : null;
      } catch {
        return null;
      }
    }),
  );
  const livePriceByAssetId = new Map(
    liveQuotes.flatMap((quote) => (quote ? [[quote.assetId, quote.price]] : [])),
  );
  const overviewPositions = (positionsResult.data ?? []).flatMap((position) => {
    const asset = assetsById.get(position.asset_id);
    if (!asset) return [];
    const institutionId =
      institutionIdByAssetId.get(position.asset_id) ?? asset.institution_id;
    const isUsdAsset = asset.asset_class === "US_ETF";
    const currentAmount =
      livePriceByAssetId.get(position.asset_id) === undefined
        ? Number(position.current_amount)
        : livePriceByAssetId.get(position.asset_id)! * Number(position.quantity);
    const appliedAmount = Number(position.invested_amount);

    return [
      {
        assetId: asset.id,
        assetClass: asset.asset_class,
        currentAmount: isUsdAsset
          ? usdBrl
            ? currentAmount * usdBrl
            : 0
          : currentAmount,
        institution: institutionId
          ? (institutionsById.get(institutionId) ?? "—")
          : "—",
        investedAmount: isUsdAsset
          ? usdBrl
            ? appliedAmount * usdBrl
            : 0
          : appliedAmount,
        name: asset.name,
        fixedIncomeSubtype: asset.fixed_income_subtype,
        quantity: Number(position.quantity),
        ticker: asset.ticker?.startsWith("manual-") ? null : asset.ticker,
        usdCurrentAmount: isUsdAsset ? currentAmount : undefined,
        usdInvestedAmount: isUsdAsset ? appliedAmount : undefined,
      },
    ];
  });
  const overviewInstitutions = [
    ...new Set(
      overviewPositions
        .map((position) => position.institution)
        .filter((institution) => institution !== "—"),
    ),
  ].sort();
  const consolidatedInvestedAmount = overviewPositions.reduce(
    (total, position) => total + position.investedAmount,
    0,
  );
  const consolidatedCurrentAmount = overviewPositions.reduce(
    (total, position) => total + position.currentAmount,
    0,
  );
  const sortedTransactions = [...(transactionsResult.data ?? [])].sort((first, second) =>
    first.transaction_date.localeCompare(second.transaction_date),
  );
  const portfolioValueAt = (cutoff: string) => {
    const balances = new Map<string, { investedAmount: number; quantity: number }>();

    for (const transaction of sortedTransactions) {
      if (transaction.transaction_date > cutoff) break;
      const asset = assetsById.get(transaction.asset_id);
      const amount =
        Number(transaction.total_amount) *
        (asset?.asset_class === "US_ETF" ? usdBrl : 1);
      const quantity = Number(transaction.quantity);
      const balance = balances.get(transaction.asset_id) ?? {
        investedAmount: 0,
        quantity: 0,
      };
      if (
        transaction.transaction_type === "BUY" ||
        transaction.transaction_type === "BONUS"
      ) {
        balance.investedAmount += amount;
        balance.quantity += quantity;
      } else if (balance.quantity > 0) {
        balance.investedAmount -=
          (balance.investedAmount / balance.quantity) * quantity;
        balance.quantity -= quantity;
      }
      balances.set(transaction.asset_id, balance);
    }

    return [...balances.values()].reduce(
      (total, balance) => total + Math.max(0, balance.investedAmount),
      0,
    );
  };
  const today = new Date().toISOString().slice(0, 10);
  const evolutionFor = (references: Array<{ cutoff: string; label: string }>) =>
    references.map((reference) => ({
      label: reference.label,
      value:
        reference.cutoff === today
          ? consolidatedCurrentAmount
          : portfolioValueAt(reference.cutoff),
    }));
  const formatDay = (value: Date) =>
    new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "UTC",
    }).format(value);
  const dailyReferences = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - (6 - index));
    return { cutoff: date.toISOString().slice(0, 10), label: formatDay(date) };
  });
  const weeklyReferences = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - (6 - index) * 7);
    return { cutoff: date.toISOString().slice(0, 10), label: formatDay(date) };
  });
  const monthlyReferences = monthReferences.map((month) => {
    const date = new Date(`${month}-01T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + 1);
    date.setUTCDate(0);
    return {
      cutoff:
        month === monthReferences[monthReferences.length - 1]
          ? today
          : date.toISOString().slice(0, 10),
      label: monthLabel(month),
    };
  });
  const currentYear = new Date(`${today}T12:00:00Z`).getUTCFullYear();
  const yearlyReferences = Array.from({ length: 7 }, (_, index) => {
    const year = currentYear - (6 - index);
    return {
      cutoff: year === currentYear ? today : `${year}-12-31`,
      label: String(year),
    };
  });
  const portfolioEvolution = {
    days: evolutionFor(dailyReferences),
    weeks: evolutionFor(weeklyReferences),
    months: evolutionFor(monthlyReferences),
    years: evolutionFor(yearlyReferences),
  };

  return (
    <section className="space-y-8">
      <InvestmentsOverviewContent
        assets={assetsResult.data?.length ?? 0}
        currentAmount={consolidatedCurrentAmount}
        investedAmount={consolidatedInvestedAmount}
        institutions={overviewInstitutions}
        months={proventsMonths}
        portfolioEvolution={portfolioEvolution}
        positions={overviewPositions}
        usdBrl={usdBrl || undefined}
      />
      {!assetTypes.size ? (
        <section className="rounded-2xl border border-dashed border-emerald-400/25 bg-[#191c21] p-6">
          <h2 className="font-semibold text-white">Comece sua carteira</h2>
          <p className="mt-2 text-sm text-slate-400">
            Importe negociações da B3 ou cadastre manualmente CDBs e ETFs
            americanos.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              className="rounded-xl bg-[#00e599] px-4 py-2.5 text-sm font-semibold text-[#003822]"
              href="/investments/import"
            >
              Importar B3
            </Link>
            <Link
              className="rounded-xl border border-white/12 px-4 py-2.5 text-sm font-semibold text-slate-200"
              href="/investments/products"
            >
              Cadastrar produto
            </Link>
          </div>
        </section>
      ) : null}
    </section>
  );
}
