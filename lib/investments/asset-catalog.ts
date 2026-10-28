export const investmentAssetNames: Record<string, string> = {
  B3SA3: "B3 S.A. · Brasil, Bolsa, Balcão",
  BBAS3: "Banco do Brasil S.A.",
  BBSE3: "BB Seguridade Participações S.A.",
  BRCO11: "Bresco Logística FII",
  BTLG11: "BTG Pactual Logística FII",
  CSMG3: "Copasa MG",
  CXSE3: "Caixa Seguridade Participações S.A.",
  FLRY3: "Fleury S.A.",
  ISAE4: "Isa Energia Brasil S.A.",
  ITSA4: "Itaúsa S.A.",
  KLBN11: "Klabin S.A.",
  KNCR11: "Kinea Rendimentos Imobiliários FII",
  KNRI11: "Kinea Renda Imobiliária FII",
  QQQ: "INVESCO QQQ TRUST",
  SAPR11: "Sanepar",
  TAEE11: "Taesa",
  TRXF11: "TRX Real Estate FII",
  VISC11: "Vinci Shopping Centers FII",
  WEGE3: "WEG S.A.",
};

export function investmentAssetName(ticker: string | null, name: string) {
  return ticker ? (investmentAssetNames[ticker] ?? name) : name;
}
