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
};

const cardNameSchema = z.string().trim().min(1).max(100);
const otherBankSchema = z.string().trim().min(1).max(80);

export function parseCreditCardInput(input: {
  bank: unknown;
  otherBank: unknown;
  name: unknown;
}) {
  const name = cardNameSchema.safeParse(input.name);
  if (!name.success) {
    return {
      error: "Informe um nome de cartão com até 100 caracteres.",
    } as const;
  }

  if (input.bank === "other") {
    const otherBank = otherBankSchema.safeParse(input.otherBank);
    if (!otherBank.success) {
      return { error: "Informe o nome do banco emissor." } as const;
    }
    return { data: { bankName: otherBank.data, name: name.data } } as const;
  }

  const bank = creditCardBanks.find((item) => item.key === input.bank);
  if (!bank) return { error: "Selecione um banco emissor." } as const;

  return { data: { bankName: bank.name, name: name.data } } as const;
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
