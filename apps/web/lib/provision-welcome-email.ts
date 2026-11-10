import "server-only";
import { SUPABASE_URL } from "@/lib/env";

type ProvisionPayload = {
  user_id: string;
  email: string;
  password: string;
};

/** Send only after Auth confirms the account and its course assignments. */
export async function sendAdminLecturerProvisionWelcome(payload: ProvisionPayload, serviceKey: string): Promise<boolean> {
  const endpoint = `${SUPABASE_URL}/functions/v1/registration-welcome`;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-provision-service-key": serviceKey,
        "x-welcome-action": "provision",
      },
      body: JSON.stringify(payload),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      return false;
    }
    const result = await response.json() as { sent?: boolean };
    return result.sent === true;
  } catch {
    return false;
  }
}
