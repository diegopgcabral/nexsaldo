import {
  expenseCategoryIconKeys,
  type ExpenseCategoryIconKey,
} from "@/lib/financial/category";

const categoryRules: Array<[string[], ExpenseCategoryIconKey, string]> = [
  [
    ["medicamento", "remedio", "remedios"],
    "medicine",
    "text-sky-300 bg-sky-400/10 border-sky-400/20",
  ],
  [
    ["aliment", "mercado", "refei"],
    "food",
    "text-emerald-300 bg-emerald-400/10 border-emerald-400/20",
  ],
  [["agua"], "water", "text-sky-300 bg-sky-400/10 border-sky-400/20"],
  [["gas"], "gas", "text-orange-300 bg-orange-400/10 border-orange-400/20"],
  [
    ["energia", "luz"],
    "energy",
    "text-amber-300 bg-amber-400/10 border-amber-400/20",
  ],
  [
    ["telefone", "telefonia"],
    "phone",
    "text-cyan-300 bg-cyan-400/10 border-cyan-400/20",
  ],
  [
    ["tv", "internet"],
    "tv",
    "text-violet-300 bg-violet-400/10 border-violet-400/20",
  ],
  [
    ["seguro"],
    "insurance",
    "text-indigo-300 bg-indigo-400/10 border-indigo-400/20",
  ],
  [
    ["academia", "fitness"],
    "gym",
    "text-rose-300 bg-rose-400/10 border-rose-400/20",
  ],
  [
    ["saude", "farmacia"],
    "health",
    "text-cyan-300 bg-cyan-400/10 border-cyan-400/20",
  ],
  [
    ["educa", "curso", "faculdade"],
    "education",
    "text-emerald-300 bg-emerald-400/10 border-emerald-400/20",
  ],
  [
    ["assinatura", "streaming"],
    "subscription",
    "text-pink-300 bg-pink-400/10 border-pink-400/20",
  ],
  [
    ["servico"],
    "services",
    "text-teal-300 bg-teal-400/10 border-teal-400/20",
  ],
  [["cartao"], "card", "text-purple-300 bg-purple-400/10 border-purple-400/20"],
  [
    ["combustivel", "transporte", "uber"],
    "car",
    "text-amber-300 bg-amber-400/10 border-amber-400/20",
  ],
  [["invest"], "money", "text-lime-300 bg-lime-400/10 border-lime-400/20"],
  [
    ["compra", "loja"],
    "shopping",
    "text-orange-300 bg-orange-400/10 border-orange-400/20",
  ],
  [
    ["lazer", "cinema", "jogo"],
    "leisure",
    "text-fuchsia-300 bg-fuchsia-400/10 border-fuchsia-400/20",
  ],
  [
    ["domest", "limpeza", "diarista"],
    "domestic",
    "text-teal-300 bg-teal-400/10 border-teal-400/20",
  ],
  [
    ["moradia", "aluguel", "condominio", "casa"],
    "home",
    "text-sky-300 bg-sky-400/10 border-sky-400/20",
  ],
];

const iconColors: Record<ExpenseCategoryIconKey, string> = {
  food: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20",
  home: "text-sky-300 bg-sky-400/10 border-sky-400/20",
  card: "text-purple-300 bg-purple-400/10 border-purple-400/20",
  car: "text-amber-300 bg-amber-400/10 border-amber-400/20",
  health: "text-cyan-300 bg-cyan-400/10 border-cyan-400/20",
  medicine: "text-sky-300 bg-sky-400/10 border-sky-400/20",
  education: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20",
  subscription: "text-pink-300 bg-pink-400/10 border-pink-400/20",
  services: "text-teal-300 bg-teal-400/10 border-teal-400/20",
  water: "text-sky-300 bg-sky-400/10 border-sky-400/20",
  gas: "text-orange-300 bg-orange-400/10 border-orange-400/20",
  energy: "text-amber-300 bg-amber-400/10 border-amber-400/20",
  phone: "text-cyan-300 bg-cyan-400/10 border-cyan-400/20",
  tv: "text-violet-300 bg-violet-400/10 border-violet-400/20",
  insurance: "text-indigo-300 bg-indigo-400/10 border-indigo-400/20",
  gym: "text-rose-300 bg-rose-400/10 border-rose-400/20",
  investment: "text-lime-300 bg-lime-400/10 border-lime-400/20",
  money: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20",
  shopping: "text-orange-300 bg-orange-400/10 border-orange-400/20",
  leisure: "text-fuchsia-300 bg-fuchsia-400/10 border-fuchsia-400/20",
  domestic: "text-teal-300 bg-teal-400/10 border-teal-400/20",
  pet: "text-orange-300 bg-orange-400/10 border-orange-400/20",
  travel: "text-sky-300 bg-sky-400/10 border-sky-400/20",
  gift: "text-pink-300 bg-pink-400/10 border-pink-400/20",
  family: "text-violet-300 bg-violet-400/10 border-violet-400/20",
  work: "text-blue-300 bg-blue-400/10 border-blue-400/20",
  bill: "text-yellow-300 bg-yellow-400/10 border-yellow-400/20",
  other: "text-slate-300 bg-slate-400/10 border-slate-400/20",
};

function normalize(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function isIconKey(
  value: string | null | undefined,
): value is ExpenseCategoryIconKey {
  return Boolean(
    value && expenseCategoryIconKeys.includes(value as ExpenseCategoryIconKey),
  );
}

export function ExpenseCategoryIcon({
  name,
  iconKey,
  compact = false,
}: {
  name: string;
  iconKey?: string | null;
  compact?: boolean;
}) {
  const normalized = normalize(name);
  const match = categoryRules.find(([terms]) =>
    terms.some((term) => normalized.includes(term)),
  );
  const icon = isIconKey(iconKey) ? iconKey : (match?.[1] ?? "other");
  const colors = iconColors[icon];

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center border ${compact ? "size-8 rounded-lg" : "size-11 rounded-xl"} ${colors}`}
    >
      <svg
        className={compact ? "size-4" : "size-5"}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <CategoryIconPath icon={icon} />
      </svg>
    </span>
  );
}

function CategoryIconPath({ icon }: { icon: ExpenseCategoryIconKey }) {
  switch (icon) {
    case "food":
      return (
        <path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3m-3 8v10m7-18v8h2l2-8m-2 8v10" />
      );
    case "home":
      return (
        <path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9Zm6 10v-6h6v6" />
      );
    case "card":
      return (
        <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm0 3h18M7 15h3" />
      );
    case "car":
      return (
        <path d="m5 16 1.5-6h11L19 16v3H5v-3Zm2-6 1-3h8l1 3M7.5 19h.01M16.5 19h.01" />
      );
    case "health":
      return (
        <path d="M20.8 8.8c0 5.4-8.8 10.2-8.8 10.2S3.2 14.2 3.2 8.8A4.5 4.5 0 0 1 12 7.4a4.5 4.5 0 0 1 8.8 1.4Z" />
      );
    case "medicine":
      return (
        <path d="m8.3 18.7-3-3a3.5 3.5 0 0 1 0-5l5.4-5.4a3.5 3.5 0 1 1 5 5l-5.4 5.4a3.5 3.5 0 0 1-5 0ZM8 8l8 8" />
      );
    case "education":
      return (
        <path d="m3 9 9-5 9 5-9 5-9-5Zm4 2.2V16c2.7 2 7.3 2 10 0v-4.8M21 9v6" />
      );
    case "subscription":
      return <path d="M4 6h16v12H4V6Zm0 3h16m-9 4h2" />;
    case "services":
      return (
        <path d="M14.7 6.3a4.5 4.5 0 0 0-6 6L3.5 17.5a2.1 2.1 0 0 0 3 3l5.2-5.2a4.5 4.5 0 0 0 6-6l-2.8 2.8-3.4-1.1-1.1-3.4 2.8-2.8a4.5 4.5 0 0 0 1.5 1.5Z" />
      );
    case "water":
      return <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />;
    case "gas":
      return <path d="M12 21c4 0 6-2.7 6-6.1 0-3.2-2-5.2-4.7-8.5.1 2.4-1.1 4-2.6 5.2C10.8 8.3 8.9 6.2 7 4c.3 3.4-1 5.2-2.1 7.1C3.8 13.1 4 16 6 18.3A8 8 0 0 0 12 21Zm0-2.5c-1.6 0-2.7-1-2.7-2.5 0-1.2.9-2.3 2.7-4.3 1.8 2 2.7 3.1 2.7 4.3 0 1.5-1.1 2.5-2.7 2.5Z" />;
    case "energy":
      return <path d="m13 2-8 12h6l-1 8 8-12h-6l1-8Z" />;
    case "phone":
      return (
        <path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm3 15h4" />
      );
    case "tv":
      return <path d="M4 7h16v11H4V7Zm5-4 3 4 3-4M8 21h8" />;
    case "insurance":
      return (
        <path d="M12 3 5 6v5c0 4.7 2.8 8.6 7 10 4.2-1.4 7-5.3 7-10V6l-7-3Zm-3 9 2 2 4-4" />
      );
    case "gym":
      return <path d="M4 9v6m3-8v10m10-10v10m3-8v6M7 12h10" />;
    case "investment":
      return <path d="m4 16 5-5 3 3 7-8M15 6h4v4M4 20h16" />;
    case "money":
      return (
        <path d="M3 6h18v12H3V6Zm4 6h.01M17 12h.01M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
      );
    case "shopping":
      return <path d="M5 8h14l-1 12H6L5 8Zm3 0a4 4 0 0 1 8 0" />;
    case "leisure":
      return (
        <path d="M7 8h10l2 5-3 2-2-2h-4l-2 2-3-2 2-5Zm2-3h6M8 18h.01M16 18h.01" />
      );
    case "domestic":
      return <path d="m7 3 10 10M5 5l3-2 2 2-2 3M14 14l-3 7 7-3" />;
    case "pet":
      return (
        <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm8 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-4-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 5c-3.4 0-6 2.1-6 4.6 0 1.5 1.3 2.4 2.7 1.8l1.3-.5h4l1.3.5c1.4.6 2.7-.3 2.7-1.8C18 15.1 15.4 13 12 13Z" />
      );
    case "travel":
      return <path d="m3 13 18-6-7 7 4 5-2 1-5-4-4 2-2-2 2-4-4-1Z" />;
    case "gift":
      return (
        <path d="M4 10h16v10H4V10Zm0-4h16v4H4V6Zm8 0v14M9 6c-2 0-3-1-3-2.2C6 2.8 7 2 8 2c2 0 4 4 4 4s2-4 4-4c1 0 2 .8 2 1.8C18 5 17 6 15 6" />
      );
    case "family":
      return (
        <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3 21v-2a5 5 0 0 1 10 0v2m1-6a4.5 4.5 0 0 1 7 3.7V21" />
      );
    case "work":
      return <path d="M4 8h16v11H4V8Zm5 0V5h6v3M4 12h16m-9 0v2h2v-2" />;
    case "bill":
      return <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6M9 16h3" />;
    default:
      return (
        <path d="M7 3h5v5H7V3Zm5 5h5v5h-5V8Zm-5 5h5v5H7v-5Zm5 5h5v3h-5v-3Z" />
      );
  }
}
