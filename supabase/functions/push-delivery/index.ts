import { createClient } from "npm:@supabase/supabase-js@2.117.3";
// @deno-types="npm:@types/web-push@3.6.4"
import webpush from "npm:web-push@3.6.7";
import { allowedEndpoint, retryAfterSeconds } from "./policy.ts";

// This function accepts a dedicated scheduler secret, never a user JWT.
async function authorized(request: Request): Promise<boolean> {
  const secret = Deno.env.get("PUSH_WORKER_SECRET");
  if (!secret || secret.length < 32) return false;
  const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  const [a, b] = await Promise.all([digest(request.headers.get("x-push-worker-secret") ?? ""), digest(secret)]);
  return a.reduce((difference, value, index) => difference | (value ^ b[index]), 0) === 0;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST" || !(await authorized(request))) return new Response("Unauthorized", { status: 401 });
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publicKey = Deno.env.get("PUSH_VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("PUSH_VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("PUSH_VAPID_SUBJECT");
  if (!url || !key) return new Response("Worker configuration missing", { status: 503 });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  async function rpc<T>(name: string, args = {}): Promise<T> {
    const { data, error } = await db.rpc(name, args);
    if (error) throw new Error("Push worker database operation failed");
    return data as T;
  }
  try {
    // Always prepare inbox fan-out, even when VAPID is not configured or delivery is paused.
    await rpc("prepare_push_batch_v1");
    if (!publicKey || !privateKey || !subject) return new Response("Inbox prepared; delivery credentials missing", { status: 503 });
    const jobs = await rpc<Array<{ id: string; lease: string }>>("claim_push_jobs_v1", { p_limit: 20 });
    let accepted = 0;
    // Five concurrent requests, at most twenty attempts per invocation; each has a hard deadline.
    for (let offset = 0; offset < jobs.length; offset += 5) {
      await Promise.all(jobs.slice(offset, offset + 5).map(async (job) => {
        const args = { p_id: job.id, p_lease: job.lease };
        const delivery = await rpc<null | {
          subscription: { endpoint: string; keys: { auth: string; p256dh: string } };
          expires_at: string; payload: Record<string, unknown>;
        }>("authorize_push_job_v1", args);
        if (!delivery) return;
        let code = 400;
        let retry: number | null = null;
        if (allowedEndpoint(delivery.subscription.endpoint)) {
          try {
            const ttl = Math.max(0, Math.floor((Date.parse(delivery.expires_at) - Date.now()) / 1000));
            if (ttl === 0) { await rpc("finish_push_job_v1", { ...args, p_code: 400 }); return; }
            // Generate encrypted RFC8291 payload/VAPID headers with the maintained Web Push library.
            // fetch redirect:error prevents a provider redirect from reaching an unapproved host.
            const details = webpush.generateRequestDetails(delivery.subscription, JSON.stringify(delivery.payload), {
              TTL: Math.min(ttl, 86400), urgency: "high",
              vapidDetails: { subject, publicKey, privateKey },
            });
            const response = await fetch(delivery.subscription.endpoint, {
              method: "POST", headers: details.headers,
              body: details.body ? new Uint8Array(details.body).buffer : undefined,
              redirect: "error", signal: AbortSignal.timeout(10_000),
            });
            code = response.status;
            retry = retryAfterSeconds(response.headers.get("retry-after"));
            await response.body?.cancel();
          } catch { code = 0; }
        }
        await rpc("finish_push_job_v1", { ...args, p_code: code, p_retry_seconds: retry });
        if (code >= 200 && code < 300) accepted++;
      }));
    }
    return Response.json({ processed: jobs.length, accepted });
  } catch {
    // Do not log subscription endpoints, payloads, credentials or provider response bodies.
    return new Response("Worker operation failed; leased jobs will recover", { status: 503 });
  }
});
