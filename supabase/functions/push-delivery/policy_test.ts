import { allowedEndpoint, retryAfterSeconds } from "./policy.ts";
function equal(actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
}
Deno.test("browser endpoint allowlist blocks redirects to attacker-controlled hosts", () => {
  for (const endpoint of ["https://fcm.googleapis.com/fcm/send/token", "https://updates.push.services.mozilla.com/wpush/v2/token", "https://web.push.apple.com/token", "https://wns2.notify.windows.com/token"]) equal(allowedEndpoint(endpoint), true);
  for (const endpoint of ["https://fcm.googleapis.com.attacker.test/token", "https://user@fcm.googleapis.com/token", "https://127.0.0.1/token", "http://fcm.googleapis.com/token", "https://fcm.googleapis.com:8443/token", "https://fcm.googleapis.com/token#fragment"]) equal(allowedEndpoint(endpoint), false);
});
Deno.test("Retry-After supports seconds and HTTP dates with bounded retry intervals", () => {
  equal(retryAfterSeconds(null), null);
  equal(retryAfterSeconds("not-a-date"), null);
  equal(retryAfterSeconds("0"), 30);
  equal(retryAfterSeconds("120"), 120);
  equal(retryAfterSeconds("999999"), 86400);
  equal(retryAfterSeconds("Sat, 17 Oct 2026 12:02:00 GMT", Date.parse("2026-10-17T12:00:00Z")), 120);
});

Deno.test("Chromium legacy Google push endpoint is narrowly permitted", () => {
  equal(allowedEndpoint("https://jmt17.google.com/fcm/send/device:token"), true);
  equal(allowedEndpoint("https://jmt17.google.com/log"), false);
  equal(allowedEndpoint("https://jmt17.google.com/fcm/send/"), false);
  equal(allowedEndpoint("https://jmt17.google.com.attacker.test/fcm/send/token"), false);
  equal(allowedEndpoint("https://jmt18.google.com/fcm/send/token"), false);
  equal(allowedEndpoint("https://jmt17.google.com:8443/fcm/send/token"), false);
  equal(allowedEndpoint("https://jmt17.google.com@127.0.0.1/fcm/send/token"), false);
});
