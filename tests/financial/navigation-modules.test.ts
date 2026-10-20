import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultNavigationModules,
  hasPeopleModule,
  normalizeNavigationModules,
} from "@/lib/financial/navigation-modules";

test("uses every module by default for profiles without preferences", () => {
  assert.deepEqual(normalizeNavigationModules(null), defaultNavigationModules);
});

test("keeps unknown values out of navigation preferences", () => {
  assert.deepEqual(
    normalizeNavigationModules({
      transactions: false,
      creditCards: true,
      investments: "yes",
      unknown: false,
    }),
    { transactions: false, creditCards: true, investments: true },
  );
});

test("people module follows the credit cards dependency", () => {
  assert.equal(
    hasPeopleModule({
      transactions: true,
      creditCards: false,
      investments: true,
    }),
    false,
  );
});
