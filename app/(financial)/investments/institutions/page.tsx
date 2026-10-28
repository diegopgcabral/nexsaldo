import { createInvestmentInstitution } from "@/app/(financial)/investments/actions";
import { createClient } from "@/lib/supabase/server";

export default async function InvestmentInstitutionsPage() {
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
            .select("institution_id")
            .eq("user_id", userId),
        ])
      : [{ data: [] }, { data: [] }];
  const assetCountByInstitution = new Map<string, number>();
  for (const asset of assetsResult.data ?? []) {
    if (asset.institution_id) {
      assetCountByInstitution.set(
        asset.institution_id,
        (assetCountByInstitution.get(asset.institution_id) ?? 0) + 1,
      );
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-[.16em] text-emerald-300 uppercase">
          Investimentos
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">
          Instituições
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Corretoras e bancos onde sua carteira está custodiada.
        </p>
      </div>
      <form
        action={createInvestmentInstitution}
        className="rounded-2xl bg-[#191c21] p-5"
      >
        <label
          className="block text-sm font-semibold text-white"
          htmlFor="institution-name"
        >
          Nova instituição
        </label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            className="income-input flex-1"
            id="institution-name"
            name="name"
            placeholder="Ex.: Inter Invest"
            required
          />
          <button
            className="rounded-xl bg-[#00e599] px-5 py-2.5 text-sm font-semibold text-[#003822]"
            type="submit"
          >
            Adicionar
          </button>
        </div>
      </form>
      <section className="overflow-hidden rounded-2xl bg-[#191c21]">
        <div className="border-b border-white/7 px-5 py-4">
          <h2 className="font-semibold text-white">Cadastradas</h2>
        </div>
        {institutionsResult.data?.length ? (
          <div className="divide-y divide-white/6">
            {institutionsResult.data.map((institution) => {
              const count = assetCountByInstitution.get(institution.id) ?? 0;
              return (
                <div
                  className="flex items-center justify-between gap-4 px-5 py-4"
                  key={institution.id}
                >
                  <span className="font-medium text-white">
                    {institution.name}
                  </span>
                  <span className="rounded-md bg-emerald-400/10 px-2 py-1 text-xs text-emerald-200">
                    {count} {count === 1 ? "ativo" : "ativos"}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="px-5 py-6 text-sm text-slate-400">
            Nenhuma instituição cadastrada.
          </p>
        )}
      </section>
    </section>
  );
}
