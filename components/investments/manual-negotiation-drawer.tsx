"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createManualInvestmentTransaction,
  type ManualInvestmentTransactionState,
} from "@/app/(financial)/investments/actions";
import { CurrencyInput } from "@/components/financial/currency-input";
import { Icon } from "@/components/financial/icons";
import { useToast } from "@/components/financial/toast-provider";

type Institution = { id: string; name: string };

const productOptions = [
  { className: "bg-sky-400/10 text-sky-300", icon: "money", label: "Renda fixa", value: "FIXED_INCOME" },
  { className: "bg-violet-400/10 text-violet-300", icon: "dashboard", label: "Ações", value: "STOCK" },
  { className: "bg-emerald-400/10 text-emerald-300", icon: "briefcase", label: "FIIs", value: "FII" },
  { className: "bg-blue-400/10 text-blue-300", icon: "wallet", label: "ETFs americanos", value: "US_ETF" },
  { className: "bg-cyan-400/10 text-cyan-300", icon: "wallet", label: "ETFs brasileiros", value: "BRAZILIAN_ETF" },
  { className: "bg-indigo-400/10 text-indigo-300", icon: "dashboard", label: "BDRs", value: "BDR" },
  { className: "bg-fuchsia-400/10 text-fuchsia-300", icon: "briefcase", label: "Fundos de investimento", value: "FUND" },
  { className: "bg-rose-400/10 text-rose-300", icon: "shield", label: "Previdência", value: "PENSION" },
  { className: "bg-amber-400/10 text-amber-300", icon: "category", label: "Cripto", value: "CRYPTO" },
] as const;

const fixedIncomeOptions = [
  { label: "Tesouro Direto", value: "DIRECT_TREASURY" },
  { label: "CDB", value: "CDB" },
  { label: "LCI", value: "LCI" },
  { label: "LCA", value: "LCA" },
  { label: "Debênture", value: "DEBENTURE" },
  { label: "CRI / CRA", value: "CRI_CRA" },
  { label: "Caixinha", value: "CASH_BOX" },
  { label: "Outro", value: "OTHER" },
] as const;

const brandStyles = [
  { match: ["nubank", "nu invest"], className: "bg-[#820ad1]/20 text-[#c58cff]", label: "Nu" },
  { match: ["xp"], className: "bg-[#00a889]/15 text-[#4ce3c0]", label: "XP" },
  { match: ["inter"], className: "bg-[#ff7a00]/15 text-[#ffac61]", label: "IN" },
  { match: ["btg"], className: "bg-[#2d65b2]/20 text-[#8cbcff]", label: "BTG" },
  { match: ["itaú", "itau"], className: "bg-[#ec7000]/15 text-[#ffad6d]", label: "Itaú" },
];

function institutionBrand(name: string) {
  const normalized = name.toLocaleLowerCase("pt-BR");
  const brand = brandStyles.find((style) =>
    style.match.some((match) => normalized.includes(match)),
  );
  return brand ?? {
    className: "bg-emerald-400/10 text-emerald-300",
    label: name.slice(0, 2).toUpperCase(),
  };
}

function todayReference() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function parseQuantity(value: string) {
  const normalized = value.includes(",")
    ? value.replaceAll(".", "").replace(",", ".")
    : value;
  return Number(normalized) || 0;
}

export function ManualNegotiationDrawer({
  assets,
  institutions,
  isOpen,
  onClose,
  productTypes,
}: {
  assets: Array<{ assetClass: string; name: string; ticker: string }>;
  institutions: Institution[];
  isOpen: boolean;
  onClose: () => void;
  productTypes: string[];
}) {
  const [state, formAction, pending] = useActionState(
    createManualInvestmentTransaction,
    {} as ManualInvestmentTransactionState,
  );
  const [transactionType, setTransactionType] = useState("BUY");
  const [assetClass, setAssetClass] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [picker, setPicker] = useState<
    "asset" | "fixedIncome" | "institution" | "ticker" | null
  >(null);
  const [fixedIncomeSubtype, setFixedIncomeSubtype] = useState("");
  const [ticker, setTicker] = useState("");
  const [tickerQuery, setTickerQuery] = useState("");
  const [assetName, setAssetName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState(0);
  const { notify } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (state.error) notify("error", state.error);
    if (state.success) {
      notify("success", state.success);
      router.refresh();
      onClose();
    }
  }, [notify, onClose, router, state.error, state.success]);

  const productOptionsForPortfolio = productOptions.filter((product) =>
    productTypes.includes(product.value),
  );
  const selectedProduct = productOptions.find(
    (product) => product.value === assetClass,
  );
  const selectedInstitution = institutions.find(
    (institution) => institution.id === institutionId,
  );
  const totalAmount = parseQuantity(quantity) * unitPrice;
  const matchingAssets = assets.filter(
    (asset) =>
      asset.assetClass === assetClass &&
      `${asset.ticker} ${asset.name}`
        .toLocaleLowerCase("pt-BR")
        .includes(tickerQuery.toLocaleLowerCase("pt-BR")),
  );
  const tickerExists = matchingAssets.some(
    (asset) =>
      asset.ticker.toLocaleUpperCase("pt-BR") ===
      tickerQuery.toLocaleUpperCase("pt-BR"),
  );

  return (
    <div
      aria-hidden={!isOpen}
      className={`fixed inset-0 z-60 ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}
    >
      <button
        aria-label="Fechar cadastro de negociação"
        className={`absolute inset-0 bg-black/55 transition-opacity ${isOpen ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
        type="button"
      />
      <aside
        aria-label="Adicionar negociação"
        className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-white/10 bg-[#111319] shadow-2xl transition-transform duration-300 ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/8 p-6">
          <div>
            <p className="text-xs font-semibold tracking-[.16em] text-emerald-300 uppercase">
              Minha carteira
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              Adicionar negociação
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Registre uma compra ou venda feita fora da importação B3.
            </p>
          </div>
          <button
            aria-label="Fechar"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
            onClick={onClose}
            type="button"
          >
            <Icon name="close" />
          </button>
        </div>
        <form action={formAction} className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-6 overflow-y-auto p-6">
            <fieldset>
              <legend className="income-label mb-2">Operação</legend>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["BUY", "Compra"],
                  ["SELL", "Venda"],
                ].map(([value, label]) => (
                  <label
                    className={`cursor-pointer rounded-xl border p-3 text-center text-sm font-medium transition ${transactionType === value ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-200" : "border-white/8 bg-[#191c21] text-slate-400"}`}
                    key={value}
                  >
                    <input
                      checked={transactionType === value}
                      className="sr-only"
                      name="transactionType"
                      onChange={() => setTransactionType(value)}
                      type="radio"
                      value={value}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="relative space-y-1.5">
              <span className="income-label">Tipo de produto</span>
              <input name="assetClass" type="hidden" value={assetClass} />
              <button
                className="income-input flex min-h-[46px] w-full items-center gap-3 text-left"
                onClick={() => setPicker((current) => current === "asset" ? null : "asset")}
                type="button"
              >
                {selectedProduct ? (
                  <>
                    <span className={`flex size-6 shrink-0 items-center justify-center rounded-lg ${selectedProduct.className}`}>
                      <Icon className="size-4" name={selectedProduct.icon} />
                    </span>
                    <span className="flex-1 font-medium text-slate-100">{selectedProduct.label}</span>
                  </>
                ) : (
                  <span className="flex-1 text-xs text-slate-500">Selecione o tipo</span>
                )}
                <Icon className="size-4 text-slate-400" name={picker === "asset" ? "chevronUp" : "chevronDown"} />
              </button>
              {picker === "asset" ? (
                <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-white/8 bg-[#0b0e13] p-2 shadow-2xl">
                  {productOptionsForPortfolio.map((product) => (
                    <button
                      className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-[#1d2025]"
                      key={product.value}
                      onClick={() => {
                        setAssetClass(product.value);
                        setFixedIncomeSubtype("");
                        setTicker("");
                        setTickerQuery("");
                        setAssetName("");
                        setPicker(null);
                      }}
                      type="button"
                    >
                      <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${product.className}`}>
                        <Icon className="size-4" name={product.icon} />
                      </span>
                      <span className="flex-1 text-sm font-medium text-slate-100">{product.label}</span>
                      {assetClass === product.value ? <Icon className="size-4 text-emerald-300" name="check" /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {assetClass === "FIXED_INCOME" ? (
              <div className="relative space-y-1.5">
                <span className="income-label">Tipo de renda fixa</span>
                <input name="fixedIncomeSubtype" type="hidden" value={fixedIncomeSubtype} />
                <button
                  className="income-input flex min-h-[46px] w-full items-center gap-3 text-left"
                  onClick={() =>
                    setPicker((current) =>
                      current === "fixedIncome" ? null : "fixedIncome",
                    )
                  }
                  type="button"
                >
                  {fixedIncomeSubtype ? (
                    <>
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-sky-400/10 text-sky-300">
                        <Icon className="size-4" name="money" />
                      </span>
                      <span className="flex-1 font-medium text-slate-100">
                        {fixedIncomeOptions.find(
                          (option) => option.value === fixedIncomeSubtype,
                        )?.label}
                      </span>
                    </>
                  ) : (
                    <span className="flex-1 text-xs text-slate-500">
                      Selecione o subtipo
                    </span>
                  )}
                  <Icon
                    className="size-4 text-slate-400"
                    name={
                      picker === "fixedIncome" ? "chevronUp" : "chevronDown"
                    }
                  />
                </button>
                {picker === "fixedIncome" ? (
                  <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-white/8 bg-[#0b0e13] p-2 shadow-2xl">
                  {fixedIncomeOptions.map((option) => (
                    <button
                      className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-[#1d2025]"
                      key={option.value}
                      onClick={() => {
                        setFixedIncomeSubtype(option.value);
                        setPicker(null);
                      }}
                      type="button"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-400/10 text-sky-300">
                        <Icon className="size-4" name="money" />
                      </span>
                      <span className="flex-1 text-sm font-medium text-slate-100">
                        {option.label}
                      </span>
                      {fixedIncomeSubtype === option.value ? (
                        <Icon className="size-4 text-emerald-300" name="check" />
                      ) : null}
                    </button>
                  ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="relative space-y-1.5">
              <span className="income-label">Instituição</span>
              <input name="institutionId" type="hidden" value={institutionId} />
              <button
                className="income-input flex min-h-[46px] w-full items-center gap-3 text-left"
                onClick={() => setPicker((current) => current === "institution" ? null : "institution")}
                type="button"
              >
                {selectedInstitution ? (
                  <>
                    {(() => {
                      const brand = institutionBrand(selectedInstitution.name);
                      return <span className={`flex size-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${brand.className}`}>{brand.label}</span>;
                    })()}
                    <span className="flex-1 font-medium text-slate-100">{selectedInstitution.name}</span>
                  </>
                ) : (
                  <span className="flex-1 text-xs text-slate-500">Selecione a instituição</span>
                )}
                <Icon className="size-4 text-slate-400" name={picker === "institution" ? "chevronUp" : "chevronDown"} />
              </button>
              {picker === "institution" ? (
                <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-white/8 bg-[#0b0e13] p-2 shadow-2xl">
                  {institutions.map((institution) => {
                    const brand = institutionBrand(institution.name);
                    return (
                      <button
                        className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-[#1d2025]"
                        key={institution.id}
                        onClick={() => {
                          setInstitutionId(institution.id);
                          setPicker(null);
                        }}
                        type="button"
                      >
                        <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${brand.className}`}>{brand.label}</span>
                        <span className="flex-1 text-sm font-medium text-slate-100">{institution.name}</span>
                        {institutionId === institution.id ? <Icon className="size-4 text-emerald-300" name="check" /> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {!institutions.length ? (
                <span className="block text-xs text-amber-300">
                  Cadastre uma instituição antes de adicionar uma negociação.
                </span>
              ) : null}
            </div>
            <div className="relative space-y-1.5">
                <span className="income-label">Ticker / código</span>
                <input name="ticker" type="hidden" value={ticker} />
                <button
                  className="income-input flex min-h-[46px] w-full items-center gap-3 text-left"
                  disabled={!assetClass}
                  onClick={() =>
                    setPicker((current) =>
                      current === "ticker" ? null : "ticker",
                    )
                  }
                  type="button"
                >
                  {ticker ? (
                    <>
                      <span className="rounded-md bg-emerald-400/10 px-2 py-1 text-xs font-semibold text-emerald-200">
                        {ticker}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-300">
                        {assetName || "Ativo selecionado"}
                      </span>
                    </>
                  ) : (
                    <span className="flex-1 text-xs text-slate-500">
                      {assetClass
                        ? "Selecione ou adicione o código"
                        : "Selecione o tipo primeiro"}
                    </span>
                  )}
                  <Icon
                    className="size-4 text-slate-400"
                    name={picker === "ticker" ? "chevronUp" : "chevronDown"}
                  />
                </button>
                {picker === "ticker" && assetClass ? (
                  <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-white/8 bg-[#0b0e13] p-2 shadow-2xl">
                    <div className="relative border-b border-white/6 px-1 pb-2">
                      <Icon
                        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-[60%] text-slate-500"
                        name="search"
                      />
                      <input
                        autoFocus
                        className="income-input h-10 py-2 pr-3 pl-9 text-sm placeholder:text-xs"
                        onChange={(event) =>
                          setTickerQuery(event.target.value.toUpperCase())
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Escape") setPicker(null);
                        }}
                        placeholder="Buscar ou adicionar código"
                        value={tickerQuery}
                      />
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {matchingAssets.map((asset) => (
                        <button
                          className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-[#1d2025]"
                          key={`${asset.assetClass}:${asset.ticker}`}
                          onClick={() => {
                            setTicker(asset.ticker);
                            setAssetName(asset.name);
                            setTickerQuery("");
                            setPicker(null);
                          }}
                          type="button"
                        >
                          <span className="rounded-md bg-emerald-400/10 px-2 py-1 text-xs font-semibold text-emerald-200">
                            {asset.ticker}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-slate-300">
                            {asset.name}
                          </span>
                        </button>
                      ))}
                      {tickerQuery.trim() && !tickerExists ? (
                        <button
                          className="flex w-full items-center gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/8 p-2.5 text-left transition hover:bg-emerald-400/12"
                          onClick={() => {
                            setTicker(tickerQuery);
                            setAssetName("");
                            setTickerQuery("");
                            setPicker(null);
                          }}
                          type="button"
                        >
                          <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300">
                            <Icon className="size-4" name="plus" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-emerald-200">
                              Usar “{tickerQuery}” como novo ativo
                            </span>
                            <span className="block text-xs text-emerald-300/80">
                              Você poderá informar o nome abaixo.
                            </span>
                          </span>
                        </button>
                      ) : null}
                      {!matchingAssets.length && !tickerQuery.trim() ? (
                        <p className="px-3 py-4 text-center text-xs text-slate-500">
                          Nenhum ticker cadastrado para este produto.
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
            </div>
            <label className="block space-y-1.5">
              <span className="income-label">Data da negociação</span>
              <input
                className="income-input [color-scheme:dark]"
                defaultValue={todayReference()}
                name="transactionDate"
                required
                type="date"
              />
            </label>
            <label className="block space-y-1.5 pb-2">
              <span className="income-label">
                Nome do ativo <span className="font-normal text-slate-500">(opcional)</span>
              </span>
              <input
                className="income-input placeholder:text-xs"
                name="name"
                onChange={(event) => setAssetName(event.target.value)}
                placeholder="Usaremos o ticker se não informar"
                value={assetName}
              />
            </label>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="income-label">Quantidade</span>
                <input
                  className="income-input placeholder:text-xs"
                  inputMode="decimal"
                  name="quantity"
                  onChange={(event) => {
                    const [whole, ...decimal] = event.target.value
                      .replaceAll(".", ",")
                      .replace(/[^\d,]/g, "")
                      .split(",");
                    setQuantity(
                      decimal.length ? `${whole},${decimal.join("")}` : whole,
                    );
                  }}
                  pattern="[0-9]+([,][0-9]+)?"
                  placeholder="0"
                  required
                  type="text"
                  value={quantity}
                />
              </label>
              <label className="space-y-1.5">
                <span className="income-label">Preço unitário</span>
                <CurrencyInput
                  name="unitPrice"
                  onAmountChange={setUnitPrice}
                  required
                />
              </label>
            </div>
            <label className="space-y-1.5">
              <span className="income-label">Valor total calculado</span>
              <input
                className="income-input cursor-not-allowed font-semibold text-slate-300"
                disabled
                value={`R$ ${formatCurrency(totalAmount)}`}
              />
              <input
                name="totalAmount"
                type="hidden"
                value={totalAmount.toFixed(2)}
              />
            </label>
          </div>
          <div className="mt-auto flex gap-3 border-t border-white/8 p-6">
            <button
              className="flex-1 rounded-xl border border-white/12 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/5"
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#00e599] px-4 py-2.5 text-sm font-semibold text-[#003822] disabled:opacity-60"
              disabled={pending || !institutions.length}
              type="submit"
            >
              <Icon className="size-4" name="plus" />
              {pending ? "Salvando…" : "Salvar negociação"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
