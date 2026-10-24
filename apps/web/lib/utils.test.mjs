import assert from "node:assert/strict";
import test from "node:test";
import { safeNext } from "./utils.ts";

test("post-login destinations stay on the app origin", () => {
  for (const next of ["https://example.com", "//example.com", "/\\example.com", "/\n/example.com", "/\t/example.com", "", null, undefined]) {
    assert.equal(safeNext(next, "/auth/continue"), "/auth/continue");
  }
  for (const next of ["/home", "/auth/continue", "/courses?semester=1", "/profile#settings"]) {
    assert.equal(safeNext(next, "/auth/continue"), next);
    assert.equal(new URL(next, "https://scholau.vercel.app").origin, "https://scholau.vercel.app");
  }
});
