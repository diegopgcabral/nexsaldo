type TwelveDataQuote = {
  close?: string;
  currency?: string;
  message?: string;
  price?: string;
  status?: string;
};

export async function fetchTwelveDataQuote(symbol: string) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) throw new Error("A chave da Twelve Data não foi configurada.");

  const response = await fetch(
    `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`,
    { cache: "no-store" },
  );
  const data = (await response.json()) as TwelveDataQuote;
  const price = Number(data.close ?? data.price);
  if (!response.ok || data.status === "error" || !Number.isFinite(price)) {
    throw new Error(data.message ?? "Não foi possível consultar a cotação.");
  }

  return {
    currency: data.currency?.toUpperCase() ?? "USD",
    price,
    quotedAt: new Date().toISOString(),
  };
}
