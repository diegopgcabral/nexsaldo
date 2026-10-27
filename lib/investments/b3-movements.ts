import { inflateRawSync } from "node:zlib";

export const allowedStockTickers = new Set([
  "CSMG3",
  "FLRY3",
  "B3SA3",
  "WEGE3",
  "KLBN11",
  "TAEE11",
  "BBAS3",
  "ITSA4",
  "BBSE3",
  "ISAE4",
  "CXSE3",
  "SAPR11",
  "VALE3",
  "PETR4",
]);

export const allowedFiiTickers = new Set([
  "KNCR11",
  "TRXF11",
  "BRCO11",
  "VISC11",
  "KNRI11",
  "BTLG11",
]);

export type InvestmentAssetClass = "FIXED_INCOME" | "STOCK" | "FII";
export type InvestmentTransactionType =
  "BUY" | "SELL" | "BONUS" | "SPLIT" | "CORPORATE_ACTION" | "TRANSFER_OUT";

export type B3Negotiation = {
  assetClass: InvestmentAssetClass;
  date: string;
  institution: string;
  market: string;
  maturityDate: string;
  name: string;
  operation: string;
  quantity: number;
  rowNumber: number;
  ticker: string | null;
  totalAmount: number | null;
  tradeCode: string;
  transactionType: InvestmentTransactionType;
  unitPrice: number | null;
};

export type B3ImportPreview = {
  excludedAssetRows: number;
  ignoredRows: number;
  items: B3Negotiation[];
  positions: Array<{
    assetClass: InvestmentAssetClass;
    investedAmount: number;
    name: string;
    quantity: number;
    ticker: string | null;
  }>;
  sourceRows: number;
};

const expectedHeaders = [
  "Data do Negócio",
  "Tipo de Movimentação",
  "Mercado",
  "Prazo/Vencimento",
  "Instituição",
  "Código de Negociação",
  "Quantidade",
  "Preço",
  "Valor",
];

const supportedOperations: Record<string, InvestmentTransactionType> = {
  Compra: "BUY",
  Venda: "SELL",
};

function decodeXml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function textBetween(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match ? decodeXml(match[1].replace(/<[^>]+>/g, "")) : "";
}

function zipEntries(buffer: Buffer) {
  let end = -1;
  for (
    let index = buffer.length - 22;
    index >= Math.max(0, buffer.length - 65_557);
    index -= 1
  ) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      end = index;
      break;
    }
  }
  if (end < 0) throw new Error("Arquivo Excel inválido.");

  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  const entries = new Map<string, Buffer>();

  for (let entryIndex = 0; entryIndex < count; entryIndex += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50)
      throw new Error("Arquivo Excel inválido.");
    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer
      .subarray(offset + 46, offset + 46 + nameLength)
      .toString("utf8");

    if (buffer.readUInt32LE(localOffset) !== 0x04034b50)
      throw new Error("Arquivo Excel inválido.");
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const payloadStart = localOffset + 30 + localNameLength + localExtraLength;
    const payload = buffer.subarray(
      payloadStart,
      payloadStart + compressedSize,
    );

    entries.set(
      name,
      compression === 0
        ? payload
        : compression === 8
          ? inflateRawSync(payload)
          : (() => {
              throw new Error("Formato de compressão não suportado.");
            })(),
    );
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function parseSharedStrings(xml: string) {
  return [...xml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)].map((match) =>
    decodeXml(
      [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
        .map((text) => text[1])
        .join(""),
    ),
  );
}

function columnIndex(reference: string) {
  const letters = reference.match(/[A-Z]+/)?.[0] ?? "A";
  return (
    [...letters].reduce(
      (total, letter) => total * 26 + letter.charCodeAt(0) - 64,
      0,
    ) - 1
  );
}

function parseWorksheet(xml: string, sharedStrings: string[]) {
  return [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((row) => {
    const values: string[] = [];
    for (const cell of row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const reference = cell[1].match(/\br="([^"]+)"/)?.[1] ?? "A1";
      const type = cell[1].match(/\bt="([^"]+)"/)?.[1];
      const raw = textBetween(cell[2], "v");
      const value =
        type === "s" && raw
          ? sharedStrings[Number(raw)]
          : type === "inlineStr"
            ? textBetween(cell[2], "t")
            : raw;
      values[columnIndex(reference)] = value;
    }
    return values;
  });
}

function parseNumber(value: string) {
  if (!value || value === "-") return null;
  const normalized = value.includes(",")
    ? value.replaceAll(".", "").replace(",", ".")
    : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function normalizeInstitution(value: string) {
  const normalized = value.trim().toUpperCase();
  if (normalized.includes("NU INVEST")) return "Nubank";
  if (normalized.includes("XP INVESTIMENTOS")) return "XP";
  return value.trim();
}

function classifyAsset(
  tradeCode: string,
): Pick<B3Negotiation, "assetClass" | "name" | "ticker"> | null {
  const ticker = tradeCode.trim().toUpperCase().replace(/F$/, "");
  if (!ticker) return null;
  if (allowedFiiTickers.has(ticker))
    return { assetClass: "FII", name: ticker, ticker };
  if (allowedStockTickers.has(ticker))
    return { assetClass: "STOCK", name: ticker, ticker };
  return null;
}

export function parseB3Negotiations(file: ArrayBuffer): B3ImportPreview {
  const entries = zipEntries(Buffer.from(file));
  const sharedStrings = entries.get("xl/sharedStrings.xml")?.toString("utf8");
  const worksheet = entries.get("xl/worksheets/sheet1.xml")?.toString("utf8");
  if (!sharedStrings || !worksheet)
    throw new Error("Não encontrei a planilha de negociação no arquivo.");

  const rows = parseWorksheet(worksheet, parseSharedStrings(sharedStrings));
  if (expectedHeaders.some((header, index) => rows[0]?.[index] !== header)) {
    throw new Error(
      "Este arquivo não é o relatório de negociação da B3 esperado.",
    );
  }

  let excludedAssetRows = 0;
  let ignoredRows = 0;
  const items: B3Negotiation[] = [];

  rows.slice(1).forEach((row, index) => {
    const asset = classifyAsset(row[5] ?? "");
    if (!asset) {
      excludedAssetRows += 1;
      return;
    }

    const transactionType = supportedOperations[row[1] ?? ""];
    if (!transactionType) {
      ignoredRows += 1;
      return;
    }

    const date = parseDate(row[0] ?? "");
    const quantity = parseNumber(row[6] ?? "");
    if (!date || quantity === null || quantity <= 0 || !row[4] || !row[5]) {
      ignoredRows += 1;
      return;
    }

    items.push({
      ...asset,
      date,
      institution: normalizeInstitution(row[4]),
      market: row[2] ?? "—",
      maturityDate: row[3] ?? "—",
      name: asset.name,
      operation: row[1],
      quantity: transactionType === "SELL" ? -quantity : quantity,
      rowNumber: index + 2,
      totalAmount: parseNumber(row[8] ?? ""),
      tradeCode: row[5].trim(),
      transactionType,
      unitPrice: parseNumber(row[7] ?? ""),
    });
  });

  const positions = new Map<string, B3ImportPreview["positions"][number]>();
  for (const item of items) {
    const key = `${item.assetClass}:${item.ticker ?? item.name}`;
    const current = positions.get(key) ?? { ...item, investedAmount: 0 };
    current.quantity += positions.has(key) ? item.quantity : 0;
    if (item.totalAmount !== null)
      current.investedAmount +=
        item.quantity < 0 ? -item.totalAmount : item.totalAmount;
    positions.set(key, current);
  }

  return {
    excludedAssetRows,
    ignoredRows,
    items: items.sort(
      (a, b) => a.date.localeCompare(b.date) || a.rowNumber - b.rowNumber,
    ),
    positions: [...positions.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    sourceRows: rows.length - 1,
  };
}
