const app = "https://scholau.com";

type ProvisionPayload = { user_id: string; email: string; display_name: string; password: string };

const messages = {
  student: {
    subject: "Welcome to ScholAu",
    title: "We’re glad you’re here",
    body: (name: string) =>
      `Hi ${name}, welcome to ScholAu—we’re really happy to have you with us. We hope you enjoy using the app, find studying a little easier and a little more fun, and have a great experience from your first day onward. Whenever you’re ready, jump in and explore at your own pace.`,
    path: "/home",
    button: "Open ScholAu",
  },
  lecturer: {
    subject: "Welcome to ScholAu",
    title: "We’re glad you’re here",
    body: (name: string) =>
      `Hi ${name}, welcome to ScholAu—we’re delighted you’ve joined as a lecturer. We hope this workspace makes teaching smoother for you and helps you support your students well. Thank you for being part of what we’re building; we’re excited to see what you do with your courses.`,
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

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function emailHtml(title: string, body: string, destination: string, button: string, credentials?: { email: string; password: string }) {
  const credentialsBlock = credentials
    ? `<div style="margin:20px 0;padding:16px;border-radius:12px;background:#f3f7fc;border:1px solid #d8e6f8"><p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#172b49">Your sign-in details</p><p style="margin:0 0 6px;font-size:15px;line-height:1.5"><strong>Email:</strong> ${escapeHtml(credentials.email)}</p><p style="margin:0;font-size:15px;line-height:1.5"><strong>Password:</strong> ${escapeHtml(credentials.password)}</p><p style="margin:12px 0 0;font-size:13px;line-height:1.5;color:#536983">You can change this password later in your account settings after you sign in.</p></div>`
    : "";
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><body style="margin:0;background:#f3f7fc;color:#172b49;font-family:Arial,sans-serif"><main style="max-width:480px;margin:32px auto;padding:28px;background:#fff;border-radius:16px"><p style="color:#0866e8;font-size:16px;font-weight:700">ScholAu</p><h1 style="font-size:24px;line-height:1.2">${escapeHtml(title)}</h1><p style="font-size:16px;line-height:1.6">${escapeHtml(body)}</p>${credentialsBlock}<p style="margin:24px 0"><a href="${destination}" style="display:inline-block;background:#0866e8;color:#fff;border-radius:8px;padding:12px 18px;text-decoration:none;font-weight:700">${escapeHtml(button)}</a></p></main></body></html>`;
}

function provisionCopy(name: string, email: string, password: string) {
  const title = "We’re glad you’re here";
  const intro = `Hi ${name}, welcome to ScholAu—we’re delighted you’ve joined as a lecturer. Use the email address and password below to sign in for the first time, or choose Continue with Google on the sign-in page when your Google account uses this same email (${email}). You can change your password later in the app whenever you like.`;
  const destination = `${app}/sign-in?next=${encodeURIComponent("/lecturer")}`;
  const text = `${title}\n\n${intro}\n\nEmail: ${email}\nPassword: ${password}\n\nSign in: ${destination}`;
  const html = emailHtml(title, intro, destination, "Sign in to ScholAu", { email, password });
  return { subject: "Welcome to ScholAu — your lecturer sign-in details", text, html };
}

async function sendProvisionedLecturer(payload: ProvisionPayload, apiKey: string, sender: string): Promise<Outcome> {
  const name = payload.display_name.trim() || "there";
  const { subject, text, html } = provisionCopy(name, payload.email, payload.password);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `scholau-provision-welcome/${payload.user_id}`,
      },
      body: JSON.stringify({ from: sender, to: [payload.email], subject, text, html }),
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

    const action = request.headers.get("x-welcome-action");
    if (action === "provision") {
      let payload: ProvisionPayload;
      try {
        payload = await request.json() as ProvisionPayload;
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }
      if (!payload?.user_id || !payload.email || !payload.password) {
        return new Response("Incomplete provision payload", { status: 400 });
      }
      const allowed = await rpc<boolean>("admin_provision_welcome_eligible_v1", { p_user_id: payload.user_id });
      if (!allowed) return new Response("Not eligible for provision welcome", { status: 403 });
      const outcome = await sendProvisionedLecturer(payload, apiKey, sender);
      if (outcome === "sent") return Response.json({ sent: true });
      return new Response("Provision welcome could not be sent", { status: outcome === "retry" ? 503 : 502 });
    }

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
