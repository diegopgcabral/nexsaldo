import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateSplitBalance,
  parsePurchaseInput,
  summarizeInvoice,
} from "../../lib/financial/credit-card-invoice";

const owner = "11111111-1111-4111-8111-111111111111";
const cardId = "22222222-2222-4222-8222-222222222222";

function purchase(
  splits: { participantId: string | null; amount: string; paidAt?: string }[],
  amount = "300,00",
) {
  return {
    id: null,
    cardId,
    description: " Mercado ",
    amount,
    purchasedOn: "2026-10-14",
    invoiceMonth: "2026-10",
    splits,
  };
}

test("normalizes a purchase and accepts an exact custom split", () => {
  assert.deepEqual(
    parsePurchaseInput(
      purchase([
        { participantId: null, amount: "160,00" },
        { participantId: owner, amount: "140,00" },
      ]),
    ),
    {
      data: {
        ...purchase(
          [
            { participantId: null, amount: "160.00" },
            { participantId: owner, amount: "140.00" },
          ],
          "300.00",
        ),
        description: "Mercado",
      },
    },
  );
});

test("rejects differences, duplicate people and non-positive allocations", () => {
  assert.match(
    parsePurchaseInput(purchase([{ participantId: null, amount: "299,99" }]))
      .error ?? "",
    /soma/i,
  );
  assert.match(
    parsePurchaseInput(
      purchase([
        { participantId: null, amount: "100,00" },
        { participantId: null, amount: "200,00" },
      ]),
    ).error ?? "",
    /única vez/i,
  );
  assert.ok(
    "error" in
      parsePurchaseInput(purchase([{ participantId: null, amount: "0" }])),
  );
});

test("requires a valid invoice month", () => {
  assert.ok(
    "error" in
      parsePurchaseInput({
        ...purchase([{ participantId: null, amount: "300,00" }]),
        invoiceMonth: "2026-13",
      }),
  );
});

test("summarizes each participant by card and for the month", () => {
  const first = {
    id: owner,
    cardId,
    description: "Mercado",
    amount: "300.00",
    purchasedOn: "2026-10-14",
    invoiceMonth: "2026-10",
    splits: [
      { participantId: null, amount: "160.00" },
      {
        participantId: owner,
        amount: "140.00",
        paidAt: "2026-10-15T12:00:00.000Z",
      },
    ],
  };
  const second = {
    ...first,
    id: cardId,
    cardId: owner,
    amount: "500.00",
    splits: [{ participantId: owner, amount: "500.00" }],
  };
  const summary = summarizeInvoice([first, second]);
  assert.equal(summary.total, 80000n);
  assert.equal(summary.cardTotals.get(cardId), 30000n);
  assert.equal(summary.cardTotals.get(owner), 50000n);
  assert.equal(summary.personCardTotals.get(owner)?.get(cardId), 14000n);
  assert.equal(summary.personCardTotals.get(owner)?.get(owner), 50000n);
  assert.equal(summary.personCardPaidTotals.get(owner)?.get(cardId), 14000n);
  assert.equal(summary.personCardPaidTotals.get(owner)?.get(owner), undefined);
  assert.deepEqual(calculateSplitBalance("300,00", first.splits), {
    total: 30000n,
    allocated: 30000n,
    difference: 0n,
  });
});
