import "server-only";
import { SUPABASE_URL } from "@/lib/env";

type ProvisionPayload = {
  user_id: string;
  email: string;
  display_name: string;
  password: string;
};

/** Fire-and-forget: never log the password; caller decides whether to surface failures. */
export async function sendAdminLecturerProvisionWelcome(payload: ProvisionPayload): Promise<boolean> {
  const secret = process.env.WELCOME_WEBHOOK_SECRET;
  if (!secret) return false;
  const endpoint = process.env.REGISTRATION_WELCOME_WORKER_URL
    ?? `${SUPABASE_URL}/functions/v1/registration-welcome`;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-welcome-webhook-secret": secret,
        "x-welcome-action": "provision",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12_000),
    });
    const ok = response.ok;
    await response.body?.cancel().catch(() => undefined);
    return ok;
  } catch {
    return false;
  }
}

/** Compare webhook secret without timing leaks on the raw strings. */
export function webhookSecretConfigured(): boolean {
  return Boolean(process.env.WELCOME_WEBHOOK_SECRET?.length);
}
