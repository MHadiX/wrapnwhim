import { it, expect } from "vitest";
import { empty } from "../../src/lib/finance";
import { create, unlock, csv } from "../../src/lib/storage";
it("encrypts records, rejects wrong passwords and detects tampering", async () => {
  const state = empty();
  state.name = "Sensitive business";
  const { envelope } = await create("a-test-only-password", state);
  expect(JSON.stringify(envelope)).not.toContain(state.name);
  expect((await unlock("a-test-only-password", envelope)).state).toEqual(state);
  await expect(unlock("wrong-password", envelope)).rejects.toThrow();
  const damaged = {
    ...envelope,
    ciphertext:
      (envelope.ciphertext[0] === "A" ? "B" : "A") +
      envelope.ciphertext.slice(1),
  };
  await expect(unlock("a-test-only-password", damaged)).rejects.toThrow();
});
it("neutralizes spreadsheet formulas and escapes CSV fields", () => {
  expect(csv([{ name: "=SUM(A1)", notes: 'a,"b"' }])).toContain("'=SUM(A1)");
  expect(csv([{ name: "normal", notes: 'a,"b"' }])).toContain('"a,""b"""');
});
