function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(value);
}

export function InvestmentOverviewKpis({
  assets,
  institutions,
  investedAmount,
  isValuesVisible,
}: {
  assets: number;
  institutions: number;
  investedAmount: number;
  isValuesVisible: boolean;
}) {
  const currency = (value: number) =>
    isValuesVisible ? formatCurrency(value) : "••••••••";

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Kpi label="Valor investido" value={currency(investedAmount)} />
      <Kpi label="Ativos cadastrados" value={String(assets)} />
      <Kpi label="Instituições" value={String(institutions)} />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-2xl bg-[#191c21] p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </section>
  );
}
