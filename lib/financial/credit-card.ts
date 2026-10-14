import { z } from "zod";

export const creditCardBanks = [
  { key: "nubank", name: "Nubank", monogram: "Nu", tone: "violet" },
  { key: "inter", name: "Banco Inter", monogram: "in", tone: "orange" },
  {
    key: "mercado-pago",
    name: "Mercado Pago",
    monogram: "MP",
    tone: "marketYellow",
  },
  { key: "c6", name: "C6 Bank", monogram: "C6", tone: "slate" },
  { key: "itau", name: "Itaú", monogram: "I", tone: "blue" },
  { key: "bradesco", name: "Bradesco", monogram: "B", tone: "red" },
  { key: "santander", name: "Santander", monogram: "S", tone: "red" },
  { key: "xp", name: "XP Investimentos", monogram: "XP", tone: "gold" },
  { key: "btg", name: "BTG Pactual", monogram: "BTG", tone: "blue" },
  { key: "caixa", name: "Caixa", monogram: "C", tone: "blue" },
  { key: "bb", name: "Banco do Brasil", monogram: "BB", tone: "gold" },
] as const;

export type CreditCardListItem = {
  id: string;
  bankName: string;
  name: string;
  dueDay: number | null;
};

const cardNameSchema = z.string().trim().max(100);
const otherBankSchema = z.string().trim().min(1).max(80);

export function parseCreditCardInput(input: {
  bank: unknown;
  otherBank: unknown;
  name: unknown;
  dueDay: unknown;
}) {
  const name = cardNameSchema.safeParse(input.name ?? "");
  if (!name.success) {
    return {
      error: "O nome personalizado deve ter até 100 caracteres.",
    } as const;
  }

  const dueDay = z.coerce.number().int().min(1).max(31).safeParse(input.dueDay);
  if (!dueDay.success || input.dueDay === "" || input.dueDay === null) {
    return { error: "Informe um dia de vencimento entre 1 e 31." } as const;
  }

  if (input.bank === "other") {
    const otherBank = otherBankSchema.safeParse(input.otherBank);
    if (!otherBank.success) {
      return { error: "Informe o nome do banco emissor." } as const;
    }
    return {
      data: {
        bankName: otherBank.data,
        name: name.data || otherBank.data,
        dueDay: dueDay.data,
      },
    } as const;
  }

  const bank = creditCardBanks.find((item) => item.key === input.bank);
  if (!bank) return { error: "Selecione um banco emissor." } as const;

  return {
    data: {
      bankName: bank.name,
      name: name.data || bank.name,
      dueDay: dueDay.data,
    },
  } as const;
}

export function getBankAppearance(bankName: string) {
  return (
    creditCardBanks.find((bank) => bank.name === bankName) ?? {
      key: "other",
      name: bankName,
      monogram: bankName.trim().slice(0, 2).toLocaleUpperCase("pt-BR"),
      tone: "emerald",
    }
  );
}
