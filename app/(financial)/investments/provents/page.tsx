import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { ProventsFilterButton } from "@/components/investments/provents-filter-button";
import { ProventsQuoteRefresh } from "@/components/investments/provents-quote-refresh";
import { AddProventDrawer } from "@/components/investments/add-provent-drawer";
import { CycleMonthNavigator } from "@/components/financial/cycle-month-navigator";
import { fetchTwelveDataQuote } from "@/lib/investments/twelve-data";
import { createClient } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<{
    assetId?: string;
    month?: string;
    from?: string;
    to?: string;
    products?: string;
    events?: string;
    add?: string;
  }>;
};

type ProventItem = {
  id: string;
  asset_id: string;
  received_on: string;
  provent_type: string;
  amount: number | string;
  quantity: number | string | null;
  unit_price: number | string | null;
  currency: string;
  institution: string;
  asset: {
    id: string;
    ticker: string;
    name: string;
    institution_id: string;
    asset_class: string;
  };
};

function currency(value: number, code: string) {
  const formatted = new Intl.NumberFormat(code === "USD" ? "en-US" : "pt-BR", {
    style: "currency",
    currency: code,
  }).format(value);
  return code === "USD" ? formatted.replace("$", "US$") : formatted;
}

function date(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${value}T12:00:00Z`),
  );
}

function monthAndYear(value: string) {
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
  return `${label[0]?.toUpperCase()}${label.slice(1)}`.replace(" de ", "/");
}

export default async function InvestmentProventsPage({ searchParams }: Props) {
  await connection();
  const {
    assetId,
    month = new Date().toISOString().slice(0, 7),
    from,
    to,
    products,
    events,
    add,
  } = await searchParams;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (typeof userId !== "string") return null;
  const nextMonth = new Date(`${month}-01T12:00:00`);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const nextMonthReference = nextMonth.toISOString().slice(0, 7);
  const query = supabase
    .from("investment_provents")
    .select(
      "id,asset_id,received_on,provent_type,amount,quantity,unit_price,currency,investment_assets!inner(id,ticker,name,institution_id,asset_class)",
    )
    .eq("user_id", userId)
    .order("received_on", { ascending: false });
  if (assetId) query.eq("asset_id", assetId);
  if (from) query.gte("received_on", from);
  if (to) query.lt("received_on", to);
  if (!assetId && !from && !to)
    query
      .gte("received_on", `${month}-01`)
      .lt("received_on", `${nextMonthReference}-01`);
  const [{ data: provents }, { data: institutions }, { data: assets }] =
    await Promise.all([
      query,
      supabase
        .from("investment_institutions")
        .select("id,name")
        .eq("user_id", userId),
      supabase
        .from("investment_assets")
        .select("id,name,display_name,ticker,asset_class")
        .eq("user_id", userId)
        .order("name"),
    ]);
  const institutionNames = new Map(
    (institutions ?? []).map((item) => [item.id, item.name]),
  );
  const selectedProducts = products?.split(",").filter(Boolean) ?? [];
  const selectedEvents = events?.split(",").filter(Boolean) ?? [];
  const items = (provents ?? [])
    .flatMap<ProventItem>((item) => {
      const asset = Array.isArray(item.investment_assets)
        ? item.investment_assets[0]
        : item.investment_assets;
      return asset
        ? [
            {
              ...item,
              asset,
              institution: institutionNames.get(asset.institution_id) ?? "—",
            },
          ]
        : [];
    })
    .filter(
      (item) =>
        (!selectedProducts.length ||
          selectedProducts.includes(item.asset.asset_class)) &&
        (!selectedEvents.length || selectedEvents.includes(item.provent_type)),
    );
  const periodLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${month}-01T12:00:00`));
  const selectedAsset = items[0]?.asset;
  const title = assetId ? (selectedAsset?.ticker ?? "Ativo") : "Proventos";
  const periodTitle =
    from || to
      ? `${from ? monthAndYear(from) : "Início"} — ${to ? monthAndYear(new Date(new Date(`${to}T12:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10)) : "Hoje"}`
      : periodLabel;
  const total = items.reduce((sum, item) => sum + Number(item.amount), 0);
  const brlTotal = items
    .filter((item) => item.currency === "BRL")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const usdTotal = items
    .filter((item) => item.currency === "USD")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  let usdBrl = 0;
  try {
    usdBrl = (await fetchTwelveDataQuote("USD/BRL")).price;
  } catch {
    /* Keep the original-currency totals available if the quote provider is unavailable. */
  }
  const consolidatedTotal = brlTotal + usdTotal * usdBrl;
  const productGroups = [
    ["STOCK", "Ações"],
    ["FII", "FIIs"],
    ["US_ETF", "ETFs americanos"],
  ]
    .map(([assetClass, label]) => ({
      assetClass,
      label,
      items: items.filter((item) => item.asset.asset_class === assetClass),
    }))
    .filter((group) => group.items.length);
  const returnParams = new URLSearchParams({ month });
  if (from) returnParams.set("from", from);
  if (to) returnParams.set("to", to);
  if (products) returnParams.set("products", products);
  if (events) returnParams.set("events", events);
  const proventsReturnPath = `/investments/provents?${returnParams.toString()}`;
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[.16em] text-emerald-300 uppercase">
            Investimentos
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">{title}</h1>
          {!assetId ? (
            <p className="mt-1 text-sm text-slate-400">
              Acompanhe os recebimentos de dividendos, JCP e rendimentos.
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-400">
              Histórico de proventos · {selectedAsset?.name ?? "Ativo"}
            </p>
          )}
        </div>
        {!assetId ? (
          <div className="flex flex-wrap items-center gap-3">
            {!from && !to ? (
              <CycleMonthNavigator
                month={month}
                pathname="/investments/provents"
              />
            ) : null}
            <ProventsFilterButton
              key={[from, to, products, events].join("|")}
            />
            <Link
              className="rounded-xl bg-[#00e599] px-5 py-2.5 text-sm font-semibold text-[#003822]"
              href={`/investments/provents?month=${month}&add=1`}
            >
              + Adicionar recebimento
            </Link>
          </div>
        ) : null}
      </div>
      {!assetId ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            action={<ProventsQuoteRefresh />}
            label="Cotação atual do dólar"
            value={usdBrl ? currency(usdBrl, "BRL") : "Indisponível"}
          />
          <Kpi label="Proventos em reais" value={currency(brlTotal, "BRL")} />
          <Kpi label="Proventos em dólares" value={currency(usdTotal, "USD")} />
          <Kpi
            highlight
            label="Total consolidado"
            value={
              usdBrl
                ? currency(consolidatedTotal, "BRL")
                : currency(brlTotal, "BRL")
            }
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <Kpi
            highlight
            label="Total recebido"
            value={currency(total, items[0]?.currency ?? "BRL")}
          />
          <Link
            className="rounded-xl border border-emerald-400/35 px-4 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/10"
            href={`/investments/portfolio/${assetId}`}
          >
            Voltar para carteira
          </Link>
        </div>
      )}
      {!assetId ? (
        <div className="mt-8 flex items-center justify-between border-b border-emerald-400/45 pb-2">
          <h2 className="text-sm font-semibold text-white uppercase">
            {periodTitle}
          </h2>
          <span className="text-sm font-semibold text-slate-200">
            TOTAL:{" "}
            {usdBrl
              ? currency(consolidatedTotal, "BRL")
              : currency(brlTotal, "BRL")}
          </span>
        </div>
      ) : null}
      {assetId ? (
        <div className="mt-8 overflow-x-auto rounded-xl bg-[#191c21]">
          <ProventsTable assetId={assetId} items={items} month={month} />
        </div>
      ) : (
        <div className="space-y-7 pt-5">
          {productGroups.map((group) => (
            <section key={group.assetClass}>
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-2">
                <h3 className="text-sm font-semibold text-white">
                  {group.label}{" "}
                  <span className="ml-2 rounded-md bg-white/5 px-1.5 py-0.5 text-xs font-medium text-emerald-300">
                    {group.items.length}{" "}
                    {group.items.length === 1 ? "lançamento" : "lançamentos"}
                  </span>
                </h3>
                <span className="text-sm font-semibold text-slate-200">
                  TOTAL:{" "}
                  {currency(
                    group.items.reduce(
                      (sum, item) => sum + Number(item.amount),
                      0,
                    ),
                    group.items[0].currency,
                  )}
                </span>
              </div>
              <div className="overflow-x-auto rounded-xl bg-[#191c21]">
                <ProventsTable
                  assetId={assetId}
                  items={group.items}
                  month={month}
                />
              </div>
            </section>
          ))}
        </div>
      )}
      {!items.length ? (
        <p className="mt-6 text-sm text-slate-400">
          Nenhum provento registrado neste período.
        </p>
      ) : null}
      <AddProventDrawer
        assets={(assets ?? []).map((asset) => ({
          assetClass: asset.asset_class,
          id: asset.id,
          name: asset.display_name ?? asset.name,
          ticker: asset.ticker?.startsWith("manual-") ? null : asset.ticker,
        }))}
        isOpen={add === "1"}
        key={add === "1" ? "add-provent-open" : "add-provent-closed"}
        returnPath={proventsReturnPath}
      />
    </section>
  );
}

function Kpi({
  label,
  value,
  highlight,
  action,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  action?: ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${highlight ? "border-emerald-400/35 bg-emerald-400/8" : "border-white/8 bg-[#191c21]"}`}
    >
      <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
        {label}
      </p>
      <div className="mt-2 flex items-center gap-1">
        <p
          className={`text-lg font-semibold ${highlight ? "text-emerald-300" : "text-white"}`}
        >
          {value}
        </p>
        {action}
      </div>
    </div>
  );
}

function ProventsTable({
  items,
  month,
  assetId,
}: {
  items: ProventItem[];
  month: string;
  assetId?: string;
}) {
  return (
    <table
      className={`w-full table-fixed text-left ${assetId ? "min-w-[980px] text-sm" : "min-w-[1120px] text-xs"}`}
    >
      <colgroup>
        {!assetId ? <col className="w-[24%]" /> : null}
        <col className="w-[12%]" />
        <col className="w-[20%]" />
        <col className="w-[16%]" />
        <col className="w-[10%]" />
        <col className="w-[10%]" />
        <col className="w-[12%]" />
      </colgroup>
      <thead className="border-b border-white/8 bg-[#111319] text-[13px] font-semibold tracking-wide text-slate-300 uppercase">
        <tr>
          {!assetId ? <th className="px-5 py-3">Produto</th> : null}
          <th className="px-3 py-3">Pagamento</th>
          <th className="px-3 py-3">Tipo de evento</th>
          <th className="px-3 py-3">Instituição</th>
          <th className="px-3 py-3 text-right whitespace-nowrap">Quantidade</th>
          <th className="px-3 py-3 text-right whitespace-nowrap">
            Preço unitário
          </th>
          <th className="px-3 py-3 text-right whitespace-nowrap">
            Valor líquido
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white/6">
        {items.map((item, index) => (
          <tr
            className={`transition hover:bg-white/[.05] ${index % 2 === 0 ? "bg-white/[0.025]" : "bg-transparent"}`}
            key={item.id}
          >
            {!assetId ? (
              <td className="truncate px-5 py-3 font-semibold text-emerald-300">
                <span className="inline-block w-12">
                  <Link
                    href={`/investments/provents?assetId=${item.asset_id}&month=${month}`}
                  >
                    {item.asset.ticker}
                  </Link>
                </span>
                <span className="font-normal text-slate-400">
                  · {item.asset.name}
                </span>
              </td>
            ) : null}
            <td className="px-3 py-3 text-slate-300">
              {date(item.received_on)}
            </td>
            <td className="px-3 py-3 text-slate-300">
              {item.provent_type === "DIVIDEND"
                ? "Dividendo"
                : item.provent_type === "JCP"
                  ? "Juros sobre capital próprio"
                  : "Rendimento"}
            </td>
            <td className="truncate px-3 py-3 text-slate-400">
              {item.institution}
            </td>
            <td className="px-3 py-3 text-right text-slate-400">
              {item.quantity === null
                ? "—"
                : Number(item.quantity).toLocaleString("pt-BR", {
                    maximumFractionDigits: 8,
                  })}
            </td>
            <td className="px-3 py-3 text-right text-slate-400">
              {item.unit_price === null
                ? "—"
                : currency(Number(item.unit_price), item.currency)}
            </td>
            <td className="px-3 py-3 text-right font-semibold text-emerald-300">
              {currency(Number(item.amount), item.currency)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
