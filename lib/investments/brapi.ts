type BrapiQuoteResponse = {
  message?: string;
  results?: Array<{
    currency?: string;
    regularMarketPrice?: number;
  }>;
};

export async function fetchBrapiQuote(symbol: string) {
  const apiKey = process.env.BRAPI_TOKEN;
  if (!apiKey) throw new Error("A chave da BRAPI não foi configurada.");

  const response = await fetch(
    `https://brapi.dev/api/quote/${encodeURIComponent(symbol)}`,
    {
      cache: "no-store",
      headers: { Authorization: `Bearer ${apiKey}` },
    },
  );
  const data = (await response.json()) as BrapiQuoteResponse;
  const result = data.results?.[0];
  const price = Number(result?.regularMarketPrice);
  if (!response.ok || !Number.isFinite(price)) {
    throw new Error(data.message ?? "Não foi possível consultar a cotação.");
  }

  return {
    currency: result?.currency?.toUpperCase() ?? "BRL",
    price,
    quotedAt: new Date().toISOString(),
  };
}
