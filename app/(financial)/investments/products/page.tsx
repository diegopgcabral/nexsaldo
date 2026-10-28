import { createManualInvestment } from "@/app/(financial)/investments/actions";
import { createClient } from "@/lib/supabase/server";

const labels = {
  FIXED_INCOME: "Renda fixa",
  STOCK: "Ações",
  FII: "FIIs",
  US_ETF: "ETFs americanos",
  CRYPTO: "Cripto",
} as const;

export default async function InvestmentProductsPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  const [institutionsResult, assetsResult] =
    typeof userId === "string"
      ? await Promise.all([
          supabase
            .from("investment_institutions")
            .select("id, name")
            .eq("user_id", userId)
            .order("name"),
          supabase
            .from("investment_assets")
            .select("id, name, ticker, asset_class, institution_id")
            .eq("user_id", userId)
            .order("asset_class")
            .order("name"),
        ])
      : [{ data: [] }, { data: [] }];
  const institutions = institutionsResult.data ?? [];
  const institutionsById = new Map(
    institutions.map((institution) => [institution.id, institution.name]),
  );
  const assets = assetsResult.data ?? [];
  const hasInstitutions = institutions.length > 0;

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-[.16em] text-emerald-300 uppercase">
          Investimentos
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Produtos</h1>
        <p className="mt-2 text-sm text-slate-400">
          Cadastre investimentos que não entram pela B3, como CDBs e ETFs
          americanos.
        </p>
      </div>
      <form
        action={createManualInvestment}
        className="rounded-2xl bg-[#191c21] p-5"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-white">Adicionar à carteira</h2>
          <span className="text-xs text-slate-500">
            Campos com * são obrigatórios
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <input
            className="income-input"
            name="name"
            placeholder="Nome do produto *"
            required
          />
          <input
            className="income-input"
            name="ticker"
            placeholder="Código / ticker (opcional)"
          />
          <select
            className="income-input"
            defaultValue="FIXED_INCOME"
            name="assetClass"
          >
            {Object.entries(labels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            className="income-input"
            defaultValue=""
            disabled={!hasInstitutions}
            name="institutionId"
            required
          >
            <option disabled value="">
              {hasInstitutions
                ? "Instituição *"
                : "Cadastre uma instituição primeiro"}
            </option>
            {institutions.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.name}
              </option>
            ))}
          </select>
          <input
            className="income-input"
            min="0.00000001"
            name="quantity"
            placeholder="Quantidade *"
            required
            step="any"
            type="number"
          />
          <input
            className="income-input"
            min="0"
            name="investedAmount"
            placeholder="Valor investido *"
            required
            step="0.01"
            type="number"
          />
          <input
            className="income-input"
            min="0"
            name="currentAmount"
            placeholder="Valor atual *"
            required
            step="0.01"
            type="number"
          />
          <input
            className="income-input"
            name="maturityDate"
            title="Vencimento (opcional)"
            type="date"
          />
        </div>
        <button
          className="mt-4 rounded-xl bg-[#00e599] px-5 py-2.5 text-sm font-semibold text-[#003822] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!hasInstitutions}
          type="submit"
        >
          Adicionar produto
        </button>
      </form>
      <section className="overflow-hidden rounded-2xl bg-[#191c21]">
        <div className="border-b border-white/7 px-5 py-4">
          <h2 className="font-semibold text-white">Produtos cadastrados</h2>
        </div>
        {assets.length ? (
          <div className="divide-y divide-white/6">
            {assets.map((asset) => (
              <div
                className="flex items-center justify-between gap-4 px-5 py-4"
                key={asset.id}
              >
                <div>
                  <p className="font-medium text-white">
                    {asset.ticker?.startsWith("manual-")
                      ? asset.name
                      : asset.ticker
                        ? `${asset.ticker} · ${asset.name}`
                        : asset.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {labels[asset.asset_class as keyof typeof labels]} ·{" "}
                    {asset.institution_id
                      ? (institutionsById.get(asset.institution_id) ?? "—")
                      : "Sem instituição"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-5 py-6 text-sm text-slate-400">
            Nenhum produto cadastrado.
          </p>
        )}
      </section>
    </section>
  );
}
