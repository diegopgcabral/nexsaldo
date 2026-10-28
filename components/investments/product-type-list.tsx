"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  addInvestmentProductType,
  removeInvestmentProductType,
} from "@/app/(financial)/investments/actions";
import { Icon } from "@/components/financial/icons";
import { useToast } from "@/components/financial/toast-provider";

type ProductType =
  | "FIXED_INCOME"
  | "STOCK"
  | "FII"
  | "US_ETF"
  | "BRAZILIAN_ETF"
  | "BDR"
  | "FUND"
  | "PENSION"
  | "CASH_BOX"
  | "CRYPTO";

const productTypes: Array<{
  className: string;
  icon:
    | "briefcase"
    | "money"
    | "wallet"
    | "category"
    | "dashboard"
    | "shield";
  label: string;
  value: ProductType;
}> = [
  {
    className: "bg-sky-400/10 text-sky-300",
    icon: "money",
    label: "Renda fixa",
    value: "FIXED_INCOME",
  },
  {
    className: "bg-violet-400/10 text-violet-300",
    icon: "dashboard",
    label: "Ações",
    value: "STOCK",
  },
  {
    className: "bg-emerald-400/10 text-emerald-300",
    icon: "briefcase",
    label: "FIIs",
    value: "FII",
  },
  {
    className: "bg-blue-400/10 text-blue-300",
    icon: "wallet",
    label: "ETFs americanos",
    value: "US_ETF",
  },
  {
    className: "bg-cyan-400/10 text-cyan-300",
    icon: "wallet",
    label: "ETFs brasileiros",
    value: "BRAZILIAN_ETF",
  },
  {
    className: "bg-indigo-400/10 text-indigo-300",
    icon: "dashboard",
    label: "BDRs",
    value: "BDR",
  },
  {
    className: "bg-fuchsia-400/10 text-fuchsia-300",
    icon: "briefcase",
    label: "Fundos de investimento",
    value: "FUND",
  },
  {
    className: "bg-rose-400/10 text-rose-300",
    icon: "shield",
    label: "Previdência",
    value: "PENSION",
  },
  {
    className: "bg-amber-400/10 text-amber-300",
    icon: "category",
    label: "Cripto",
    value: "CRYPTO",
  },
];

export function ProductTypeList({
  assetClasses,
  productTypes: savedTypes,
}: {
  assetClasses: string[];
  productTypes: Array<{ asset_class: string; is_active: boolean }>;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState("");
  const registered = useMemo(() => {
    const types = new Set<ProductType>(["FIXED_INCOME", "STOCK", "FII"]);
    for (const assetClass of assetClasses) {
      if (productTypes.some((type) => type.value === assetClass)) {
        types.add(assetClass as ProductType);
      }
    }
    for (const type of Array.isArray(savedTypes) ? savedTypes : []) {
      if (!productTypes.some((product) => product.value === type.asset_class)) continue;
      if (type.is_active) types.add(type.asset_class as ProductType);
      else types.delete(type.asset_class as ProductType);
    }
    return types;
  }, [assetClasses, savedTypes]);
  const visibleTypes = useMemo(() => {
    const normalized = filter.trim().toLocaleLowerCase("pt-BR");
    return productTypes.filter(
      (type) =>
        registered.has(type.value) &&
        type.label.toLocaleLowerCase("pt-BR").includes(normalized),
    );
  }, [filter, registered]);
  const addType = (type: ProductType) => {
    startTransition(async () => {
      const result = await addInvestmentProductType(type);
      if (result?.error) return notify("error", result.error);
      notify("success", result?.success ?? "Tipo de produto adicionado.");
      router.refresh();
    });
  };
  const removeType = (type: ProductType) => {
    startTransition(async () => {
      const result = await removeInvestmentProductType(type);
      if (result?.error) return notify("error", result.error);
      notify("success", result?.success ?? "Tipo removido da lista.");
      router.refresh();
    });
  };

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-[.16em] text-emerald-300 uppercase">
          Investimentos
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Produtos</h1>
        <p className="mt-2 text-sm text-slate-400">
          Tipos de investimentos disponíveis na sua carteira.
        </p>
      </div>

      <section className="rounded-2xl border border-white/6 bg-[#191c21] p-4">
        <p className="text-sm font-semibold text-white">Disponíveis para adicionar</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {productTypes.filter((type) => !registered.has(type.value)).map((type) => (
            <button
              className="flex items-center gap-3 rounded-xl border border-white/8 bg-[#111319] px-3 py-2.5 text-left text-sm text-slate-300 transition hover:border-emerald-400/35 hover:bg-emerald-400/10 hover:text-emerald-200 disabled:opacity-50"
              disabled={isPending}
              key={type.value}
              onClick={() => addType(type.value)}
              type="button"
            >
              <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${type.className}`}>
                <Icon className="size-4" name={type.icon} />
              </span>
              <span className="flex-1 font-medium">{type.label}</span>
              <Icon className="size-4 text-emerald-300" name="plus" />
            </button>
          ))}
          {!productTypes.some((type) => !registered.has(type.value)) ? (
            <span className="text-sm text-slate-500">Todos os tipos estão adicionados.</span>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/6 bg-[#191c21]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/7 px-5 py-4">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-white">Produtos cadastrados</h2>
            <span className="rounded-md bg-emerald-400/10 px-2 py-1 text-xs text-emerald-200">
              {registered.size} cadastrados
            </span>
          </div>
          <div className="relative w-full sm:w-60">
            <Icon
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"
              name="search"
            />
            <input
              aria-label="Filtrar produtos"
              className="h-9 w-full rounded-lg border border-white/7 bg-[#111319] pr-9 pl-9 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-emerald-400/45"
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Buscar produto..."
              value={filter}
            />
            {filter ? (
              <button
                aria-label="Limpar filtro"
                className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/7 hover:text-white"
                onClick={() => setFilter("")}
                type="button"
              >
                <Icon className="size-3.5" name="close" />
              </button>
            ) : null}
          </div>
        </div>
        {visibleTypes.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-left text-sm">
              <thead className="border-b border-white/7 bg-[#12151a] text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-3">Produto</th>
                  <th className="w-[108px] px-3 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {visibleTypes.map((type, index) => (
                  <tr
                    className={`transition hover:bg-emerald-400/[0.04] ${
                      index % 2 === 0 ? "bg-white/[0.025]" : "bg-transparent"
                    }`}
                    key={type.value}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex size-9 items-center justify-center rounded-lg ${type.className}`}
                        >
                          <Icon className="size-4" name={type.icon} />
                        </span>
                        <span className="font-medium text-white">
                          {type.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex justify-center">
                        <button
                          aria-label={`Remover ${type.label}`}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-400/10 hover:text-red-300"
                          disabled={isPending}
                          onClick={() => removeType(type.value)}
                          type="button"
                        >
                          <Icon className="size-4" name="trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-8 text-sm text-slate-400">
            Nenhum produto encontrado.
          </p>
        )}
      </section>
    </section>
  );
}
