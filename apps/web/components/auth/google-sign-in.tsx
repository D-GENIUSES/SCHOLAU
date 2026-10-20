"use client";

import { useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { safeNext } from "@/lib/utils";

export function GoogleSignIn({ next, disabled }: { next?: string; disabled?: boolean }) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", safeNext(next, "/auth/continue"));
      callback.searchParams.set("provider", "google");
      const { data, error: authError } = await getBrowserSupabase().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callback.toString(),
          skipBrowserRedirect: true,
          queryParams: { prompt: "select_account" },
        },
      });
      if (authError || !data.url) throw new Error("Google sign-in unavailable");
      window.location.assign(data.url);
    } catch {
      setError("Google sign-in could not start. Please try again or use your email and password.");
      pending.current = false;
      setBusy(false);
    }
  }

  return <div className="flex flex-col gap-3">
    {error ? <Alert tone="error" role="alert">{error}</Alert> : null}
    <Button block variant="outline" loading={busy} disabled={disabled} onClick={() => void signIn()}>
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.04 46.98 31.9 46.98 24.55Z" />
        <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.77-4.59l-7.98-6.19A23.86 23.86 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
      </svg>
      Continue with Google
    </Button>
    <p className="text-center text-xs text-ink-muted">or continue with email</p>
  </div>;
}
