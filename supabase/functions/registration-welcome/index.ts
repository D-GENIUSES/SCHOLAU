const app = "https://scholau.com";

const messages = {
  student: {
    subject: "Welcome to ScholAu",
    title: "Welcome to ScholAu",
    body: (name: string) =>
      `Hi ${name}, your account is ready. Enroll in your courses, complete lessons, and earn XP—including a one-time 10 XP welcome bonus. Build a streak, climb the leaderboard, and try quiz battles with classmates.`,
    path: "/home",
    button: "Open ScholAu",
  },
  lecturer: {
    subject: "Welcome to the ScholAu teaching workspace",
    title: "Welcome to the teaching workspace",
    body: (name: string) =>
      `Hi ${name}, your lecturer account is active. Open your assigned courses to upload materials, publish lessons and quizzes, set challenges for students, and review class progress—all in one place.`,
    path: "/lecturer",
    button: "Go to your courses",
  },
} as const;

type Audience = keyof typeof messages;
type Job = { id: string; audience: Audience; email: string; display_name: string; attempt: number };
type Outcome = "sent" | "retry" | "failed";

async function matchesSecret(value: string, expected: string) {
  const digest = async (text: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  const [actual, wanted] = await Promise.all([digest(value), digest(expected)]);
  return actual.reduce((diff, byte, index) => diff | (byte ^ wanted[index]), 0) === 0;
}

function emailHtml(title: string, body: string, destination: string, button: string) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><body style="margin:0;background:#f3f7fc;color:#172b49;font-family:Arial,sans-serif"><main style="max-width:480px;margin:32px auto;padding:28px;background:#fff;border-radius:16px"><p style="color:#0866e8;font-size:16px;font-weight:700">ScholAu</p><h1 style="font-size:24px;line-height:1.2">${title}</h1><p style="font-size:16px;line-height:1.6">${body}</p><p style="margin:24px 0"><a href="${destination}" style="display:inline-block;background:#0866e8;color:#fff;border-radius:8px;padding:12px 18px;text-decoration:none;font-weight:700">${button}</a></p></main></body></html>`;
}

async function sendWelcome(job: Job, apiKey: string, sender: string): Promise<Outcome> {
  const template = job.audience in messages ? messages[job.audience] : messages.student;
  const name = job.display_name.trim() || "there";
  const body = template.body(name);
  const destination = app + template.path;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `scholau-registration-welcome/${job.id}`,
      },
      body: JSON.stringify({
        from: sender,
        to: [job.email],
        subject: template.subject,
        text: `${template.title}\n\n${body}\n\n${template.button}: ${destination}`,
        html: emailHtml(template.title, body, destination, template.button),
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
    const webhookSecret = Deno.env.get("WELCOME_WEBHOOK_SECRET");
    if (request.method !== "POST" || !webhookSecret ||
        !await matchesSecret(request.headers.get("x-welcome-webhook-secret") ?? "", webhookSecret)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const apiKey = Deno.env.get("RESEND_API_KEY");
    const sender = Deno.env.get("WELCOME_EMAIL_FROM") || "ScholAu <welcome@scholau.com>";
    if (!apiKey) return new Response("Email provider configuration missing", { status: 503 });

    const jobs = await rpc<Job[]>("claim_registration_welcome_emails_v1");
    const totals = { sent: 0, retry: 0, failed: 0 };
    for (let offset = 0; offset < jobs.length; offset += 10) {
      await Promise.all(jobs.slice(offset, offset + 10).map(async (job) => {
        const outcome = await sendWelcome(job, apiKey, sender);
        await rpc("finish_registration_welcome_email_v1", {
          p_user_id: job.id,
          p_attempt: job.attempt,
          p_outcome: outcome,
        });
        totals[outcome]++;
      }));
    }
    return Response.json(totals);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Registration welcome worker failed");
    return new Response("Registration welcome worker failed", { status: 503 });
  }
});
