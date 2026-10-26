import assert from "node:assert/strict";
import test from "node:test";

import { summarizeStatement } from "@/lib/financial/account-division";

test("groups participant purchases by card and subtracts payments", () => {
  const summary = summarizeStatement(
    [
      {
        cardId: "xp",
        cardName: "XP Visa",
        cardBankName: "XP",
        description: "Mercado",
        amount: "120.00",
        purchasedOn: "2026-10-10",
        installmentNumber: 1,
        installmentCount: 1,
      },
      {
        cardId: "xp",
        cardName: "XP Visa",
        cardBankName: "XP",
        description: "Sky",
        amount: "80.50",
        purchasedOn: "2026-10-11",
        installmentNumber: 2,
        installmentCount: 8,
      },
      {
        cardId: "nu",
        cardName: "Nubank",
        cardBankName: "Nubank",
        description: "Farmácia",
        amount: "30.00",
        purchasedOn: "2026-10-12",
        installmentNumber: 1,
        installmentCount: 1,
      },
    ],
    [
      {
        id: "manual",
        description: "Internet",
        amount: "75.00",
        dueOn: null,
        notes: null,
        installmentNumber: 1,
        installmentCount: 1,
        isRecurring: false,
      },
    ],
    [
      {
        id: "payment",
        description: "PIX",
        amount: "100.00",
        receivedOn: "2026-10-15",
        notes: null,
      },
    ],
  );
  assert.equal(summary.cards.length, 2);
  assert.equal(summary.cardsTotalCents, 23050n);
  assert.equal(summary.manualTotalCents, 7500n);
  assert.equal(summary.paymentsTotalCents, 10000n);
  assert.equal(summary.totalDueCents, 20550n);
});

test("separates cards with different names from the same issuer", () => {
  const summary = summarizeStatement(
    [
      {
        cardId: "nu-1",
        cardName: "Nubank Ju",
        cardBankName: "Nubank",
        description: "Sky",
        amount: "50.00",
        purchasedOn: "2026-10-10",
        installmentNumber: 1,
        installmentCount: 1,
      },
      {
        cardId: "nu-2",
        cardName: "Nubank Diego",
        cardBankName: "Nubank",
        description: "Internet",
        amount: "30.00",
        purchasedOn: "2026-10-11",
        installmentNumber: 1,
        installmentCount: 1,
      },
    ],
    [],
    [],
  );
  assert.equal(summary.cards.length, 2);
  assert.equal(summary.cards[0].name, "Nubank Ju");
  assert.equal(summary.cards[0].totalCents, 5000n);
  assert.equal(summary.cards[1].name, "Nubank Diego");
  assert.equal(summary.cards[1].totalCents, 3000n);
});

test("excludes paid card purchases from the statement", () => {
  const summary = summarizeStatement(
    [
      {
        cardId: "nu-1",
        cardName: "Nubank Ju",
        cardBankName: "Nubank",
        description: "Conta paga",
        amount: "29.87",
        purchasedOn: "2026-10-10",
        installmentNumber: 1,
        installmentCount: 1,
        paidAt: "2026-10-15T12:00:00Z",
      },
      {
        cardId: "nu-1",
        cardName: "Nubank Ju",
        cardBankName: "Nubank",
        description: "Conta em aberto",
        amount: "20.00",
        purchasedOn: "2026-10-11",
        installmentNumber: 1,
        installmentCount: 1,
        paidAt: null,
      },
    ],
    [],
    [],
  );

  assert.equal(summary.cards.length, 1);
  assert.equal(summary.cardsTotalCents, 2000n);
  assert.equal(summary.totalDueCents, 2000n);
});
