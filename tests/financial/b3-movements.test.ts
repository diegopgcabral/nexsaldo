import assert from "node:assert/strict";
import test from "node:test";

import {
  allowedFiiTickers,
  allowedStockTickers,
} from "@/lib/investments/b3-movements";

test("limits the first B3 negotiation import to the agreed assets", () => {
  assert.equal(allowedStockTickers.has("ITSA4"), true);
  assert.equal(allowedFiiTickers.has("KNCR11"), true);
  assert.equal(allowedStockTickers.has("ABEV3"), false);
  assert.equal(allowedFiiTickers.has("HGLG11"), false);
});
