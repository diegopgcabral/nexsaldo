import assert from "node:assert/strict";
import test from "node:test";

import { parseParticipantInput } from "../../lib/financial/participant";

test("trims a participant name", () => {
  assert.deepEqual(parseParticipantInput({ name: "  Ana Paula  " }), {
    data: { name: "Ana Paula" },
  });
});

test("rejects blank and overly long participant names", () => {
  assert.ok("error" in parseParticipantInput({ name: "  " }));
  assert.ok("error" in parseParticipantInput({ name: "A".repeat(101) }));
  assert.ok("error" in parseParticipantInput({ name: null }));
});
