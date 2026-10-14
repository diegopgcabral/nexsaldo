import assert from "node:assert/strict";
import test from "node:test";

import {
  formatBrazilianPhone,
  parseParticipantInput,
} from "../../lib/financial/participant";

test("trims a participant name", () => {
  assert.deepEqual(parseParticipantInput({ name: "  Ana Paula  " }), {
    data: { name: "Ana Paula", phone: null },
  });
});

test("normalizes and formats an optional Brazilian mobile phone", () => {
  assert.deepEqual(
    parseParticipantInput({ name: "Ana", phone: "(11) 99999-9999" }),
    { data: { name: "Ana", phone: "+5511999999999" } },
  );
  assert.equal(formatBrazilianPhone("+5511999999999"), "(11) 99999-9999");
  assert.ok("error" in parseParticipantInput({ name: "Ana", phone: "119999" }));
});

test("rejects blank and overly long participant names", () => {
  assert.ok("error" in parseParticipantInput({ name: "  " }));
  assert.ok("error" in parseParticipantInput({ name: "A".repeat(101) }));
  assert.ok("error" in parseParticipantInput({ name: null }));
});
