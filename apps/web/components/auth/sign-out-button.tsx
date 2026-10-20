"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { disableBrowserPush } from "@/lib/push-browser";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { Alert } from "@/components/ui/alert";

export function SignOutButton({ variant = "ghost", size = "sm", className }: Pick<ButtonProps, "variant" | "size" | "className">) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  const signOut = async () => {
    setPending(true);
    setError(false);
    await disableBrowserPush().catch(() => undefined);
    try {
      const result = await getBrowserSupabase().auth.signOut();
      if (result.error) throw result.error;
      queryClient.clear();
      window.location.replace("/home");
    } catch {
      setError(true);
      setPending(false);
    }
  };

  return (
    <>
    {error ? <Alert tone="error" role="alert">Sign-out could not be completed. Please try again.</Alert> : null}
    <Button variant={variant} size={size} className={className} loading={pending} onClick={() => void signOut()}>
      {pending ? null : <LogOut className="size-4" aria-hidden />}
      Sign out
    </Button>
    </>
  );
}
