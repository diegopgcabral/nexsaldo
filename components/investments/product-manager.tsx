"use client";

import { useMemo, useRef, useState, useTransition } from "react";

import {
  createManualInvestment,
  deleteManualInvestment,
  updateManualInvestment,
} from "@/app/(financial)/investments/actions";
import { Icon } from "@/components/financial/icons";
import { useToast } from "@/components/financial/toast-provider";

type ProductType = "FIXED_INCOME" | "STOCK" | "FII" | "US_ETF" | "CRYPTO";
type Institution = { id: string; name: string };
type Product = {
  asset_class: ProductType;
  currentAmount: number;
  id: string;
  institution_id: string | null;
  investedAmount: number;
  maturityDate: string | null;
  name: string;
  quantity: number;
  ticker: string | null;
};

const productTypes: Array<{
  icon: "briefcase" | "money" | "wallet" | "category" | "dashboard";
  label: string;
  value: ProductType;
}> = [
  { icon: "money", label: "Renda fixa", value: "FIXED_INCOME" },
  { icon: "dashboard", label: "Ações", value: "STOCK" },
  { icon: "briefcase", label: "FIIs", value: "FII" },
  { icon: "wallet", label: "ETFs americanos", value: "US_ETF" },
  { icon: "category", label: "Cripto", value: "CRYPTO" },
];

function productType(type: ProductType) {
  return productTypes.find((item) => item.value === type) ?? productTypes[0];
}

function iconStyle(type: ProductType) {
  return {
    FIXED_INCOME: "bg-sky-400/10 text-sky-300",
    STOCK: "bg-violet-400/10 text-violet-300",
    FII: "bg-emerald-400/10 text-emerald-300",
    US_ETF: "bg-blue-400/10 text-blue-300",
    CRYPTO: "bg-amber-400/10 text-amber-300",
  }[type];
}

function productName(product: Product) {
  return product.ticker?.startsWith("manual-") || !product.ticker
    ? product.name
    : `${product.ticker} · ${product.name}`;
}

export function ProductManager({
  institutions,
  products,
}: {
  institutions: Institution[];
  products: Product[];
}) {
  const { notify } = useToast();
  const [isPending, startTransition] = useTransition();
  const [selectedType, setSelectedType] = useState<ProductType>("FIXED_INCOME");
  const [isOtherTypesOpen, setOtherTypesOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const visibleProducts = useMemo(() => {
    const normalized = filter.trim().toLocaleLowerCase("pt-BR");
    return products.filter((product) =>
      `${product.name} ${product.ticker ?? ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(normalized),
    );
  }, [filter, products]);

  const submitNew = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createManualInvestment(formData);
      if (result?.error) return notify("error", result.error);
      formRef.current?.reset();
      setSelectedType("FIXED_INCOME");
      notify("success", result?.success ?? "Produto adicionado à carteira.");
    });
  };

  const submitEdit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateManualInvestment(formData);
      if (result?.error) return notify("error", result.error);
      setEditing(null);
      notify("success", result?.success ?? "Produto atualizado.");
    });
  };

  const removeProduct = (product: Product) => {
    if (!window.confirm(`Excluir ${product.name} e sua posição?`)) return;
    startTransition(async () => {
      const result = await deleteManualInvestment(product.id);
      notify(result?.error ? "error" : "success", result?.error ?? result?.success ?? "Produto excluído.");
    });
  };

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-[.16em] text-emerald-300 uppercase">Investimentos</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Produtos</h1>
        <p className="mt-2 text-sm text-slate-400">Cadastre investimentos que não entram pela B3, como CDBs e ETFs americanos.</p>
      </div>

      <form className="rounded-2xl border border-white/6 bg-[#191c21] p-5" onSubmit={submitNew} ref={formRef}>
        <label className="text-sm font-semibold text-white">Tipo do produto</label>
        <div className="relative mt-3 flex flex-wrap gap-2">
          {productTypes.slice(0, 3).map((type) => (
            <button className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${selectedType === type.value ? "border-emerald-400/45 bg-emerald-400/10 text-emerald-200" : "border-white/8 bg-[#111319] text-slate-400 hover:text-white"}`} key={type.value} onClick={() => setSelectedType(type.value)} type="button"><Icon className="size-4" name={type.icon} />{type.label}</button>
          ))}
          <button className="inline-flex items-center gap-2 rounded-xl border border-white/8 bg-[#111319] px-3 py-2 text-sm text-slate-400 transition hover:text-white" onClick={() => setOtherTypesOpen((open) => !open)} type="button"><Icon className="size-4" name="category" />Outros tipos<Icon className="size-3.5" name="chevronDown" /></button>
          {isOtherTypesOpen ? <div className="absolute z-20 mt-11 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#191c21] p-1 shadow-2xl">{productTypes.slice(3).map((type) => <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-300 hover:bg-white/5 hover:text-white" key={type.value} onClick={() => { setSelectedType(type.value); setOtherTypesOpen(false); }} type="button"><span className={`flex size-7 items-center justify-center rounded-md ${iconStyle(type.value)}`}><Icon className="size-3.5" name={type.icon} /></span>{type.label}</button>)}</div> : null}
        </div>
        <input name="assetClass" type="hidden" value={selectedType} />
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <input className="income-input" name="name" placeholder="Nome do produto *" required />
          <input className="income-input" name="ticker" placeholder="Código / ticker (opcional)" />
          <select className="income-input" defaultValue="" disabled={!institutions.length} name="institutionId" required><option disabled value="">{institutions.length ? "Instituição *" : "Cadastre uma instituição primeiro"}</option>{institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}</option>)}</select>
          <input className="income-input" min="0.00000001" name="quantity" placeholder="Quantidade *" required step="any" type="number" />
          <input className="income-input" min="0" name="investedAmount" placeholder="Valor investido *" required step="0.01" type="number" />
          <input className="income-input" min="0" name="currentAmount" placeholder="Valor atual *" required step="0.01" type="number" />
          <input className="income-input" name="maturityDate" title="Vencimento (opcional)" type="date" />
        </div>
        <button className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#00e599] px-5 py-2.5 text-sm font-semibold text-[#003822] disabled:opacity-50" disabled={!institutions.length || isPending} type="submit"><Icon className="size-4" name="plus" />Adicionar produto</button>
      </form>

      <section className="overflow-hidden rounded-2xl border border-white/6 bg-[#191c21]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/7 px-5 py-4">
          <div className="flex items-center gap-2"><h2 className="font-semibold text-white">Produtos cadastrados</h2><span className="rounded-md bg-emerald-400/10 px-2 py-1 text-xs text-emerald-200">{products.length} cadastrados</span></div>
          <div className="relative w-full sm:w-60"><Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" name="search" /><input aria-label="Filtrar produtos" className="h-9 w-full rounded-lg border border-white/7 bg-[#111319] pr-9 pl-9 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-emerald-400/45" onChange={(event) => setFilter(event.target.value)} placeholder="Buscar produto..." value={filter} />{filter ? <button aria-label="Limpar filtro" className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-white/7 hover:text-white" onClick={() => setFilter("")} type="button"><Icon className="size-3.5" name="close" /></button> : null}</div>
        </div>
        {visibleProducts.length ? <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="border-b border-white/7 bg-[#12151a] text-[11px] font-semibold tracking-wide text-slate-500 uppercase"><tr><th className="px-5 py-3">Produto</th><th className="px-5 py-3">Tipo</th><th className="px-5 py-3">Instituição</th><th className="w-[108px] px-3 py-3 text-center">Ações</th></tr></thead><tbody className="divide-y divide-white/6">{visibleProducts.map((product, index) => { const type = productType(product.asset_class); return <tr className={`transition hover:bg-emerald-400/[0.04] ${index % 2 === 0 ? "bg-white/[0.025]" : "bg-transparent"}`} key={product.id}><td className="px-5 py-3.5"><div className="flex items-center gap-3"><span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${iconStyle(product.asset_class)}`}><Icon className="size-4" name={type.icon} /></span><span className="font-medium text-white">{productName(product)}</span></div></td><td className="px-5 py-3.5 text-slate-400">{type.label}</td><td className="px-5 py-3.5 text-slate-400">{institutions.find((institution) => institution.id === product.institution_id)?.name ?? "—"}</td><td className="px-3 py-3.5"><div className="flex justify-center gap-0.5"><button aria-label={`Editar ${product.name}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/6 hover:text-emerald-300" disabled={isPending} onClick={() => setEditing(product)} type="button"><Icon className="size-4" name="edit" /></button><button aria-label={`Excluir ${product.name}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-400/10 hover:text-red-300" disabled={isPending} onClick={() => removeProduct(product)} type="button"><Icon className="size-4" name="trash" /></button></div></td></tr>; })}</tbody></table></div> : <p className="px-5 py-8 text-sm text-slate-400">{filter ? "Nenhum produto encontrado." : "Nenhum produto cadastrado."}</p>}
      </section>

      {editing ? <ProductEditor institutions={institutions} onClose={() => setEditing(null)} onSubmit={submitEdit} pending={isPending} product={editing} /> : null}
    </section>
  );
}

function ProductEditor({ institutions, onClose, onSubmit, pending, product }: { institutions: Institution[]; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; pending: boolean; product: Product }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"><form className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#191c21] p-6 shadow-2xl" onSubmit={onSubmit}><input name="id" type="hidden" value={product.id} /><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-white">Editar produto</h2><p className="mt-1 text-sm text-slate-400">Atualize os dados e a posição atual.</p></div><button aria-label="Fechar" className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white" onClick={onClose} type="button"><Icon className="size-4" name="close" /></button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><input className="income-input" defaultValue={product.name} name="name" required /><input className="income-input" defaultValue={product.ticker?.startsWith("manual-") ? "" : product.ticker ?? ""} name="ticker" placeholder="Código / ticker" /><select className="income-input" defaultValue={product.asset_class} name="assetClass">{productTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select><select className="income-input" defaultValue={product.institution_id ?? ""} name="institutionId" required>{institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}</option>)}</select><input className="income-input" defaultValue={product.quantity} min="0.00000001" name="quantity" required step="any" type="number" /><input className="income-input" defaultValue={product.investedAmount} min="0" name="investedAmount" required step="0.01" type="number" /><input className="income-input" defaultValue={product.currentAmount} min="0" name="currentAmount" required step="0.01" type="number" /><input className="income-input" defaultValue={product.maturityDate ?? ""} name="maturityDate" type="date" /></div><div className="mt-5 flex justify-end gap-3"><button className="rounded-xl border border-white/12 px-4 py-2.5 text-sm font-semibold text-slate-300" onClick={onClose} type="button">Cancelar</button><button className="rounded-xl bg-[#00e599] px-4 py-2.5 text-sm font-semibold text-[#003822]" disabled={pending} type="submit">Salvar</button></div></form></div>;
}
