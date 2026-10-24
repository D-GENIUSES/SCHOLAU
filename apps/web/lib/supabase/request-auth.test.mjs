import assert from "node:assert/strict";
import test from "node:test";
import { allowRequestWrite, isSameOriginRequest } from "./request-auth.ts";

test("cookie writes use the configured HTTPS origin behind a hosting adapter", () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  try {
    process.env.NEXT_PUBLIC_SITE_URL = "https://scholau.vercel.app";
    const internal = "http://internal-function:3000/api/admin/users";
    assert.equal(isSameOriginRequest(new Request(internal, { headers: { origin: "https://scholau.vercel.app" } })), true);
    for (const origin of ["https://attacker.example", "https://scholau.vercel.app.attacker.example", "http://scholau.vercel.app", "null"]) {
      assert.equal(allowRequestWrite(new Request(internal, { headers: { origin } })), false);
    }
    assert.equal(isSameOriginRequest(new Request(internal)), false);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  }
});

test("local cookie writes use the request origin and malformed configuration fails closed", () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  try {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const request = new Request("http://localhost:3000/api/account/photo", { headers: { origin: "http://localhost:3000" } });
    assert.equal(allowRequestWrite(request), true);
    process.env.NEXT_PUBLIC_SITE_URL = "invalid origin";
    assert.equal(allowRequestWrite(request), false);
    assert.equal(allowRequestWrite(new Request(request.url, { headers: { authorization: "Bearer token-verified-by-handler" } })), true);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  }
});
