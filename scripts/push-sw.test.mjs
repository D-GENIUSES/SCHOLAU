import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function pushFixture({ device = null, idbThrows = true } = {}) {
  const origin = "https://scholau.test";
  const listeners = {};
  const shown = [];
  const cacheStore = new Map();
  if (device) cacheStore.set(`${origin}/__scholau/push-device`, new Response(JSON.stringify(device), { headers: { "Content-Type": "application/json" } }));
  const caches = {
    open: async (name) => {
      assert.equal(name, "scholau-push-device");
      return {
        match: async (url) => cacheStore.get(url),
        put: async (url, response) => { cacheStore.set(url, response); },
        keys: async () => [...cacheStore.keys()].map((url) => ({ url, mode: "cors" })),
        delete: async (url) => cacheStore.delete(url),
      };
    },
    keys: async () => cacheStore.size ? ["scholau-push-device"] : [],
  };
  const indexedDB = {
    open() {
      if (idbThrows) throw new Error("IndexedDB unavailable in a closed webview");
      const request = { result: { createObjectStore() {}, transaction() { throw new Error("closed"); }, close() {} } };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  };
  const self = {
    location: { origin },
    addEventListener: (name, fn) => { listeners[name] = fn; },
    skipWaiting: async () => {},
    clients: { claim: async () => {}, matchAll: async () => [] },
    registration: {
      showNotification: async (title, options) => { shown.push({ title, options }); },
      pushManager: { subscribe: async () => ({ endpoint: "https://fcm.googleapis.com/fcm/send/rotated" }) },
    },
  };
  vm.runInNewContext(fs.readFileSync(new URL("../apps/web/public/push-sw.js", import.meta.url), "utf8"), {
    self, URL, Response, Date, caches, fetch: async () => new Response("fresh"), indexedDB, atob: (value) => Buffer.from(value, "base64").toString("binary"),
  });
  async function push(payload) {
    let work;
    listeners.push({
      data: payload === undefined ? undefined : { json: () => payload },
      waitUntil: (promise) => { work = promise; },
    });
    await work;
    return shown.splice(0, shown.length);
  }
  return { listeners, caches, cacheStore, origin, push };
}

const future = () => new Date(Date.now() + 60_000).toISOString();

test("a closed app still shows a valid push when local device storage is empty", async () => {
  const f = pushFixture();
  const shown = await f.push({
    id: "note-1", device_key: "device-a", title: "Course update", body: "A new lesson is ready.",
    expires_at: future(), kind: "course_content", target: "/home",
  });
  assert.equal(shown.length, 1);
  assert.equal(shown[0].title, "Course update");
  assert.equal(shown[0].options.silent, false);
  assert.equal(shown[0].options.tag, "scholau:course-updates");
  const remembered = await (await f.cacheStore.get(`${f.origin}/__scholau/push-device`)).json();
  assert.equal(remembered.key, "device-a");
  assert.equal(remembered.enabled, true);
});

test("an explicitly disabled device suppresses already-accepted pushes", async () => {
  const f = pushFixture({ device: { key: "device-a", enabled: false } });
  const shown = await f.push({
    id: "note-2", device_key: "device-a", title: "Hidden", body: "Should not appear.",
    expires_at: future(),
  });
  assert.equal(shown.length, 0);
});

test("an expired payload is not shown", async () => {
  const f = pushFixture();
  const shown = await f.push({
    id: "note-3", device_key: "device-a", title: "Late", body: "Too old.",
    expires_at: new Date(Date.now() - 1000).toISOString(),
  });
  assert.equal(shown.length, 0);
});

test("a matching enabled device shows the notification without an open window", async () => {
  const f = pushFixture({ device: { key: "device-a", enabled: true } });
  const shown = await f.push({
    id: "note-4", device_key: "device-a", title: "Battle invitation", body: "Ada challenged you.",
    expires_at: future(), kind: "battle_invitation",
  });
  assert.equal(shown.length, 1);
  assert.equal(shown[0].options.data.id, "note-4");
  assert.equal(shown[0].options.silent, false);
});

test("unusable push payloads still display a fallback so the browser keeps the subscription", async () => {
  const f = pushFixture();
  const shown = await f.push(undefined);
  assert.equal(shown.length, 1);
  assert.equal(shown[0].title, "ScholAu");
});

test("activation keeps the closed-app device record", async () => {
  const f = pushFixture({ device: { key: "keep-me", enabled: true } });
  let work;
  f.listeners.activate({ waitUntil: (promise) => { work = promise; } });
  await work;
  assert.equal(f.cacheStore.has(`${f.origin}/__scholau/push-device`), true);
});

test("subscription refresh is registered for closed-app endpoint rotation", () => {
  const f = pushFixture();
  assert.equal(typeof f.listeners.pushsubscriptionchange, "function");
});
