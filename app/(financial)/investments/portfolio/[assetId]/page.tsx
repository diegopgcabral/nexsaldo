import Link from "next/link";
import { notFound } from "next/navigation";

import { AssetDetailHeader } from "@/components/investments/asset-detail-header";
import { investmentAssetName } from "@/lib/investments/asset-catalog";
import { createClient } from "@/lib/supabase/server";

const labels: Record<string, string> = {
  BDR: "BDR",
  BRAZILIAN_ETF: "ETF brasileiro",
  CASH_BOX: "Caixinha",
  CRYPTO: "Cripto",
  FII: "FII",
  FIXED_INCOME: "Renda fixa",
  FUND: "Fundo de investimento",
  PENSION: "Previdência",
  STOCK: "Ações",
  US_ETF: "ETF americano",
};

function formatCurrency(value: number, assetClass: string) {
  const isUsd = assetClass === "US_ETF";
  const formatted = new Intl.NumberFormat(isUsd ? "en-US" : "pt-BR", {
    currency: isUsd ? "USD" : "BRL",
    style: "currency",
  }).format(value);
  return isUsd ? formatted.replace("$", "US$ ") : formatted;
}

function formatQuantity(value: number, assetClass: string) {
  return new Intl.NumberFormat(assetClass === "US_ETF" ? "en-US" : "pt-BR", {
    maximumFractionDigits: 5,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${value}T12:00:00Z`),
  );
}

export default async function InvestmentAssetPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = await params;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (typeof userId !== "string") notFound();

  const [assetResult, positionResult, transactionsResult, institutionsResult, quoteResult] =
    await Promise.all([
      supabase
        .from("investment_assets")
        .select("id, name, display_name, ticker, asset_class, institution_id")
        .eq("id", assetId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("investment_positions")
        .select("quantity, invested_amount")
        .eq("asset_id", assetId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("investment_transactions")
        .select("id, institution_id, quantity, total_amount, trade_code, transaction_date, transaction_type, unit_price")
        .eq("asset_id", assetId)
        .eq("user_id", userId)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("investment_institutions")
        .select("id, name")
        .eq("user_id", userId),
      supabase
        .from("investment_market_quotes")
        .select("currency, price, provider, quoted_at")
        .eq("asset_id", assetId)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

  const asset = assetResult.data;
  if (!asset) notFound();
  const institutions = new Map(
    (institutionsResult.data ?? []).map((institution) => [institution.id, institution.name]),
  );
  const transactions = transactionsResult.data ?? [];
  const position = positionResult.data;
  const quantity = Number(position?.quantity ?? 0);
  const investedAmount = Number(position?.invested_amount ?? 0);
  const quote = quoteResult.data;
  const quotePrice = quote ? Number(quote.price) : null;
  const currentAmount = quotePrice === null ? null : quotePrice * quantity;
  const profit = currentAmount === null ? null : currentAmount - investedAmount;
  const returnPercent = profit === null || !investedAmount ? null : (profit / investedAmount) * 100;
  const displayName = investmentAssetName(
    asset.ticker,
    asset.name,
    asset.display_name,
  );
  const groups = new Map<string, typeof transactions>();
  for (const transaction of transactions) {
    const current = groups.get(transaction.transaction_date) ?? [];
    current.push(transaction);
    groups.set(transaction.transaction_date, current);
  }

  return (
    <section className="space-y-8">
      <Link
        className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-emerald-200"
        href="/investments/portfolio"
      >
        <span aria-hidden="true">←</span> Voltar para minha carteira
      </Link>
      <AssetDetailHeader
        assetId={asset.id}
        code={asset.ticker ?? "Ativo"}
        initialName={displayName}
        institution={
          (asset.institution_id ? institutions.get(asset.institution_id) : null) ??
          (transactions[0]?.institution_id
            ? (institutions.get(transactions[0].institution_id) ?? "Instituição não informada")
            : "Instituição não informada")
        }
        quoteDetail={quote ? `Atualizado às ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(quote.quoted_at))}` : "Buscando cotação..."}
        quoteValue={asset.asset_class === "US_ETF" ? (quotePrice === null ? "—" : formatCurrency(quotePrice, asset.asset_class)) : undefined}
        type={labels[asset.asset_class] ?? "Investimento"}
      />

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Kpi label="Quantidade" value={formatQuantity(quantity, asset.asset_class)} />
        <Kpi
          label="Preço médio"
          value={quantity ? formatCurrency(investedAmount / quantity, asset.asset_class) : "—"}
        />
        <Kpi label="Valor investido" value={formatCurrency(investedAmount, asset.asset_class)} />
        <Kpi label="Valor atual" value={currentAmount === null ? "—" : formatCurrency(currentAmount, asset.asset_class)} />
        <Kpi
          label="Lucro / prejuízo"
          tone={profit === null ? undefined : profit >= 0 ? "positive" : "negative"}
          value={profit === null ? "—" : formatCurrency(profit, asset.asset_class)}
        />
        <Kpi
          label="Rentabilidade"
          tone={returnPercent === null ? undefined : returnPercent >= 0 ? "positive" : "negative"}
          value={returnPercent === null ? "—" : `${returnPercent >= 0 ? "+" : ""}${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(returnPercent)}%`}
        />
        <Kpi label="Negociações" value={String(transactions.length)} />
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-emerald-400/45 pb-2">
          <div>
            <h2 className="font-semibold text-white">Negociações</h2>
            <p className="mt-1 text-sm text-slate-400">
              Histórico de compras e vendas deste ativo.
            </p>
          </div>
          <span className="text-sm text-slate-400">{transactions.length} lançamentos</span>
        </div>
        <div className="mt-4 space-y-6">
          {[...groups.entries()].map(([date, dateTransactions]) => {
            const purchases = dateTransactions
              .filter((transaction) => transaction.transaction_type === "BUY")
              .reduce((sum, transaction) => sum + Number(transaction.total_amount), 0);
            const sales = dateTransactions
              .filter((transaction) => transaction.transaction_type === "SELL")
              .reduce((sum, transaction) => sum + Number(transaction.total_amount), 0);
            return (
              <section className="overflow-hidden rounded-xl border border-white/8 bg-[#171a1f]" key={date}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 bg-[#111319] px-4 py-3">
                  <h3 className="text-sm font-semibold text-white">{formatDate(date)}</h3>
                  <div className="flex flex-wrap gap-3 text-xs tabular-nums">
                    {purchases ? <span className="text-emerald-300">Compras: {formatCurrency(purchases, asset.asset_class)}</span> : null}
                    {sales ? <span className="text-rose-300">Vendas: {formatCurrency(sales, asset.asset_class)}</span> : null}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[760px] w-full text-left text-sm">
                    <thead className="border-b border-white/6 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                      <tr>
                        <th className="px-4 py-3">Movimentação</th>
                        <th className="px-4 py-3">Código</th>
                        <th className="px-4 py-3">Instituição</th>
                        <th className="px-4 py-3 text-right">Quantidade</th>
                        <th className="px-4 py-3 text-right">Preço unitário</th>
                        <th className="px-4 py-3 text-right">Valor total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/6">
                      {dateTransactions.map((transaction, index) => (
                        <tr className={index % 2 === 0 ? "bg-white/[0.025]" : ""} key={transaction.id}>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${transaction.transaction_type === "BUY" ? "bg-emerald-400/12 text-emerald-300" : transaction.transaction_type === "SELL" ? "bg-rose-400/12 text-rose-300" : "bg-amber-400/12 text-amber-200"}`}>
                              {transaction.transaction_type === "BUY"
                                ? "COMPRA"
                                : transaction.transaction_type === "SELL"
                                  ? "VENDA"
                                  : "AJUSTE AVENUE"}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-white">{transaction.trade_code}</td>
                          <td className="px-4 py-3 text-slate-400">{transaction.institution_id ? (institutions.get(transaction.institution_id) ?? "—") : "—"}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-200">{formatQuantity(Number(transaction.quantity), asset.asset_class)}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-200">{formatCurrency(Number(transaction.unit_price), asset.asset_class)}</td>
                          <td className="px-4 py-3 text-right font-medium tabular-nums text-white">{formatCurrency(Number(transaction.total_amount), asset.asset_class)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </section>
  );
}

function Kpi({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: "positive" | "negative";
  value: string;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-white/7 bg-[#191c21] px-4 py-3">
      <p className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">{label}</p>
      <p className={`mt-1.5 truncate text-lg font-semibold tabular-nums ${tone === "positive" ? "text-emerald-300" : tone === "negative" ? "text-rose-300" : "text-white"}`} title={value}>{value}</p>
    </section>
  );
}
