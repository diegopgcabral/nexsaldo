"use client";

import { useState } from "react";

const domains: Record<string, string> = {
  B3SA3: "b3.com.br",
  BBAS3: "bb.com.br",
  BBSE3: "bbseguridaderi.com.br",
  CSMG3: "copasa.com.br",
  CXSE3: "caixaseguridade.com.br",
  FLRY3: "fleury.com.br",
  ISAE4: "isaenergia.com.br",
  ITSA4: "itausa.com.br",
  KLBN11: "klabin.com.br",
  SAPR11: "sanepar.com.br",
  TAEE11: "taesa.com.br",
  WEGE3: "weg.net",
};

function initials(value: string) {
  return value.slice(0, 2).toUpperCase();
}

export function AssetMark({ ticker }: { ticker: string | null }) {
  const [failed, setFailed] = useState(false);
  const domain = ticker ? domains[ticker] : undefined;
  if (!domain || failed) {
    return (
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-xs font-bold text-emerald-300">
        {initials(ticker ?? "RF")}
      </span>
    );
  }

  return (
    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
      <img
        alt=""
        className="size-6 object-contain"
        onError={() => setFailed(true)}
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      />
    </span>
  );
}
