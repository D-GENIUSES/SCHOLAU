const app = "https://scholau.com";

const messages = {
  notifications: {
    subject: "Stay up to date with ScholAu",
    title: "Keep up with what matters",
    body: "Turn on notifications to get study reminders and updates from your courses. You can enable them in the app whenever you’re ready.",
    path: "/notification-settings",
  },
  streak: {
    subject: "Ready to get back to studying?",
    title: "Pick up where you left off",
    body: "It’s been a couple of days since your last visit. One short lesson is enough to get back into your routine and start a new streak.",
    path: "/home",
  },
};

type Kind = keyof typeof messages;
type Job = { id: string; kind: Kind; email: string; attempt: number };
type Outcome = "sent" | "retry" | "failed";

async function matchesSecret(value: string, expected: string) {
  const digest = async (text: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  const [actual, wanted] = await Promise.all([digest(value), digest(expected)]);
  return actual.reduce((diff, byte, index) => diff | (byte ^ wanted[index]), 0) === 0;
}

function unsubscribePage(token: string, confirmed = false) {
  const content = confirmed
    ? "<p>You’re unsubscribed from ScholAu study reminders.</p>"
    : `<p>Stop receiving ScholAu study and notification setup reminders.</p><form method="post" action="?unsubscribe=${token}"><button type="submit">Unsubscribe</button></form>`;
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ScholAu email preferences</title><main style="max-width:32rem;margin:4rem auto;padding:1rem;font:16px system-ui;color:#172b49"><h1>ScholAu email preferences</h1>${content}</main></html>`, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

async function sendEmail(job: Job, apiKey: string, sender: string, unsubscribe: string): Promise<Outcome> {
  const { subject, title, body, path } = messages[job.kind];
  const destination = app + path;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `scholau-engagement/${job.id}`,
      },
      body: JSON.stringify({
        from: sender,
        to: [job.email],
        subject,
        text: `${title}\n\n${body}\n\nOpen ScholAu: ${destination}\n\nUnsubscribe from reminders: ${unsubscribe}`,
        html: `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><body style="margin:0;background:#f3f7fc;color:#172b49;font-family:Arial,sans-serif"><main style="max-width:480px;margin:32px auto;padding:28px;background:#fff;border-radius:16px"><p style="color:#0866e8;font-size:16px;font-weight:700">ScholAu</p><h1 style="font-size:24px;line-height:1.2">${title}</h1><p style="font-size:16px;line-height:1.6">${body}</p><p style="margin:24px 0"><a href="${destination}" style="display:inline-block;background:#0866e8;color:#fff;border-radius:8px;padding:12px 18px;text-decoration:none;font-weight:700">Open ScholAu</a></p><p style="margin-top:28px;font-size:13px;color:#536983"><a href="${unsubscribe}" style="color:#536983">Unsubscribe from reminders</a></p></main></body></html>`,
        headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      }),
      signal: AbortSignal.timeout(8000),
    });
    const status = response.status;
    await response.body?.cancel();
    if (response.ok) return "sent";
    return status === 429 || status === 408 || status >= 500 ? "retry" : "failed";
  } catch {
    return "retry";
  }
}

Deno.serve(async (request) => {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return new Response("Worker configuration missing", { status: 503 });

  async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Database operation failed: ${name}`);
    }
    const body = await response.text();
    return (body ? JSON.parse(body) : undefined) as T;
  }

  try {
    const token = new URL(request.url).searchParams.get("unsubscribe");
    if (token !== null) {
      if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(token)) return new Response("Invalid link", { status: 400 });
      if (request.method === "GET") return unsubscribePage(token);
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
      await rpc("unsubscribe_engagement_emails_v1", { p_id: token });
      return unsubscribePage(token, true);
    }

    const webhookSecret = Deno.env.get("WELCOME_WEBHOOK_SECRET");
    if (request.method !== "POST" || !webhookSecret ||
        !await matchesSecret(request.headers.get("x-welcome-webhook-secret") ?? "", webhookSecret)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const apiKey = Deno.env.get("RESEND_API_KEY");
    const sender = Deno.env.get("WELCOME_EMAIL_FROM") || "ScholAu <welcome@scholau.com>";
    if (!apiKey) return new Response("Email provider configuration missing", { status: 503 });

    const jobs = await rpc<Job[]>("claim_engagement_emails_v1");
    const totals = { sent: 0, retry: 0, failed: 0 };
    for (let offset = 0; offset < jobs.length; offset += 10) {
      await Promise.all(jobs.slice(offset, offset + 10).map(async (job) => {
        const unsubscribe = `${url}/functions/v1/engagement-email?unsubscribe=${job.id}`;
        const outcome = await sendEmail(job, apiKey, sender, unsubscribe);
        await rpc("finish_engagement_email_v1", { p_id: job.id, p_attempt: job.attempt, p_outcome: outcome });
        totals[outcome]++;
      }));
    }
    return Response.json(totals);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Engagement email worker failed");
    return new Response("Engagement email worker failed", { status: 503 });
  }
});
