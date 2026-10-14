import assert from "node:assert/strict";
import test from "node:test";

import {
  getBankAppearance,
  parseCreditCardInput,
} from "../../lib/financial/credit-card";

test("resolves a selected issuer and trims the card name", () => {
  assert.deepEqual(
    parseCreditCardInput({
      bank: "nubank",
      otherBank: "",
      name: "  Pessoal  ",
    }),
    { data: { bankName: "Nubank", name: "Pessoal" } },
  );
});

test("requires an issuer and a name, including custom issuers", () => {
  assert.ok(
    "error" in parseCreditCardInput({ bank: "", otherBank: "", name: "A" }),
  );
  assert.ok(
    "error" in
      parseCreditCardInput({ bank: "other", otherBank: "", name: "A" }),
  );
  assert.ok(
    "error" in
      parseCreditCardInput({ bank: "inter", otherBank: "", name: " " }),
  );
  assert.deepEqual(
    parseCreditCardInput({
      bank: "other",
      otherBank: " Banco local ",
      name: " Uso diário ",
    }),
    { data: { bankName: "Banco local", name: "Uso diário" } },
  );
});

test("uses a neutral appearance for an issuer outside the preset list", () => {
  assert.equal(getBankAppearance("Banco local").tone, "emerald");
});

test("Mercado Pago uses its own yellow card appearance", () => {
  const parsed = parseCreditCardInput({
    bank: "mercado-pago",
    otherBank: "",
    name: "Cartão principal",
  });
  assert.deepEqual(parsed, {
    data: { bankName: "Mercado Pago", name: "Cartão principal" },
  });
  assert.equal(getBankAppearance("Mercado Pago").tone, "marketYellow");
});
