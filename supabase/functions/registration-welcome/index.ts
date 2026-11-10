const app = "https://scholau.com";

type ProvisionPayload = { user_id: string; email: string; password: string };
type ProvisionRecipient = { email: string; display_name: string | null };

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

const changePassword = "You can change your password at any time in Account settings after signing in.";

function emailHtml(title: string, body: string, destination: string, button: string, credentials?: { email: string; password: string }) {
  const paragraphs = body.split("\n\n").map(paragraph => `<p style="font-size:16px;line-height:1.6">${escapeHtml(paragraph)}</p>`).join("");
  const credentialsBlock = credentials
    ? `<div style="margin:20px 0;padding:16px;border-radius:12px;background:#f3f7fc;border:1px solid #d8e6f8">
      <p style="margin:0 0 12px;font-weight:700">Your sign-in details</p>
      <p style="margin:0 0 12px;overflow-wrap:anywhere"><strong>Email</strong><br>${escapeHtml(credentials.email)}</p>
      <p style="margin:0 0 12px;overflow-wrap:anywhere"><strong>Initial password</strong><br><code style="white-space:pre-wrap;font-size:16px">${escapeHtml(credentials.password)}</code></p>
      <p style="margin:0;font-size:14px;line-height:1.5;color:#536983">${changePassword}</p>
    </div>`
    : "";
  const signoff = credentials ? '<p style="font-size:15px;line-height:1.5">See you in ScholAu,<br>The ScholAu team</p>' : "";
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><body style="margin:0;background:#f3f7fc;color:#172b49;font-family:Arial,sans-serif"><main style="max-width:480px;margin:32px auto;padding:28px;background:#fff;border-radius:16px"><p style="color:#0866e8;font-size:16px;font-weight:700">ScholAu</p><h1 style="font-size:24px;line-height:1.2">${escapeHtml(title)}</h1>${paragraphs}${credentialsBlock}<p style="margin:24px 0"><a href="${destination}" style="display:inline-block;background:#0866e8;color:#fff;border-radius:8px;padding:12px 18px;text-decoration:none;font-weight:700">${escapeHtml(button)}</a></p>${signoff}</main></body></html>`;
}

function provisionCopy(name: string, email: string, password: string) {
  const title = `Welcome to ScholAu, ${name}!`;
  const intro = [
    `Hi ${name},`,
    "We’re glad to welcome you to ScholAu. Your lecturer account is ready, and you can sign in right away.",
    "From your lecturer dashboard, you can manage your assigned courses, share materials and announcements, create quizzes, and review your students’ results.",
  ].join("\n\n");
  const destination = `${app}/sign-in?next=${encodeURIComponent("/lecturer")}`;
  const text = `${intro}\n\nYour sign-in details\n\nEmail\n${email}\n\nInitial password\n${password}\n\n${changePassword}\n\nOpen ScholAu\n${destination}\n\nSee you in ScholAu,\nThe ScholAu team`;
  const html = emailHtml(title, intro, destination, "Open ScholAu", { email, password });
  return { subject: title, text, html };
}

async function sendProvisionedLecturer(payload: ProvisionPayload, recipient: ProvisionRecipient, apiKey: string, sender: string): Promise<Outcome> {
  const name = recipient.display_name?.trim().split(/\s+/)[0] || "there";
  const { subject, text, html } = provisionCopy(name, recipient.email, payload.password);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `scholau-provision-welcome/${payload.user_id}`,
      },
      body: JSON.stringify({ from: sender, to: [recipient.email], subject, text, html }),
      signal: AbortSignal.timeout(5000),
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

  async function rpc<T>(name: string, args: Record<string, unknown> = {}, key = serviceKey!): Promise<T> {
    const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
    if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers,
      redirect: "error",
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 401 || response.status === 403) throw new Error("Database authorization denied");
      throw new Error(`Database operation failed: ${name}`);
    }
    const body = await response.text();
    return (body ? JSON.parse(body) : undefined) as T;
  }

  try {
    if (request.method !== "POST") return new Response("Unauthorized", { status: 401 });
    const action = request.headers.get("x-welcome-action");
    const webhookSecret = Deno.env.get("WELCOME_WEBHOOK_SECRET");
    const webhook = request.headers.get("x-welcome-webhook-secret");
    const authorizedWebhook = webhookSecret && webhook && await matchesSecret(webhook, webhookSecret);
    // The service-only recipient RPC validates this credential against the project.
    const provisionKey = action === "provision" ? request.headers.get("x-provision-service-key") : null;
    if (!authorizedWebhook && !provisionKey) return new Response("Unauthorized", { status: 401 });

    const apiKey = Deno.env.get("RESEND_API_KEY");
    const sender = Deno.env.get("WELCOME_EMAIL_FROM") || "ScholAu <welcome@scholau.com>";
    if (!apiKey) return new Response("Email provider configuration missing", { status: 503 });

    if (action === "provision") {
      let payload: ProvisionPayload;
      try {
        payload = await request.json() as ProvisionPayload;
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }
      if (typeof payload?.user_id !== "string" || typeof payload.email !== "string" ||
          typeof payload.password !== "string" || !payload.password) {
        return new Response("Incomplete provision payload", { status: 400 });
      }
      const recipient = await rpc<ProvisionRecipient | null>(
        "admin_provision_welcome_recipient_v1",
        { p_user_id: payload.user_id },
        authorizedWebhook ? serviceKey : provisionKey!,
      );
      if (!recipient || recipient.email.toLowerCase() !== payload.email.toLowerCase()) {
        return new Response("Not eligible for provision welcome", { status: 403 });
      }
      let outcome = await sendProvisionedLecturer(payload, recipient, apiKey, sender);
      if (outcome === "retry") {
        outcome = await sendProvisionedLecturer(payload, recipient, apiKey, sender);
      }
      if (outcome === "sent") return Response.json({ sent: true });
      return new Response("Provision welcome could not be sent", { status: outcome === "retry" ? 503 : 502 });
    }

    const jobs = (await rpc<Job[] | null>("claim_registration_welcome_emails_v1")) ?? [];
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
    if (error instanceof Error && error.message === "Database authorization denied") {
      return new Response("Unauthorized", { status: 401 });
    }
    console.error("Registration welcome worker failed");
    return new Response("Registration welcome worker failed", { status: 503 });
  }
});
