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
      dueDay: "10",
    }),
    { data: { bankName: "Nubank", name: "Pessoal", dueDay: 10 } },
  );
});

test("requires an issuer, including custom issuers", () => {
  assert.ok(
    "error" in
      parseCreditCardInput({
        bank: "",
        otherBank: "",
        name: "A",
        dueDay: "10",
      }),
  );
  assert.ok(
    "error" in
      parseCreditCardInput({
        bank: "other",
        otherBank: "",
        name: "A",
        dueDay: "10",
      }),
  );
  assert.deepEqual(
    parseCreditCardInput({
      bank: "inter",
      otherBank: "",
      name: " ",
      dueDay: "10",
    }),
    {
      data: { bankName: "Banco Inter", name: "Banco Inter", dueDay: 10 },
    },
  );
  assert.deepEqual(
    parseCreditCardInput({
      bank: "other",
      otherBank: " Banco local ",
      name: " Uso diário ",
      dueDay: "25",
    }),
    { data: { bankName: "Banco local", name: "Uso diário", dueDay: 25 } },
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
    dueDay: "5",
  });
  assert.deepEqual(parsed, {
    data: { bankName: "Mercado Pago", name: "Cartão principal", dueDay: 5 },
  });
  assert.equal(getBankAppearance("Mercado Pago").tone, "marketYellow");
});

test("requires a valid due day from 1 to 31", () => {
  for (const dueDay of ["", "0", "32", "1.5", null]) {
    assert.ok(
      "error" in
        parseCreditCardInput({
          bank: "nubank",
          otherBank: "",
          name: "Pessoal",
          dueDay,
        }),
    );
  }
  assert.deepEqual(
    parseCreditCardInput({
      bank: "nubank",
      otherBank: "",
      name: "Pessoal",
      dueDay: "31",
    }),
    {
      data: { bankName: "Nubank", name: "Pessoal", dueDay: 31 },
    },
  );
});
