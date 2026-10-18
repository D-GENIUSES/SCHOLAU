"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { disableBrowserPush } from "@/lib/push-browser";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export function SignOutButton({ variant = "ghost", size = "sm", className }: Pick<ButtonProps, "variant" | "size" | "className">) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  const signOut = async () => {
    setPending(true);
    await disableBrowserPush().catch(() => undefined);
    await getBrowserSupabase()
      .auth.signOut()
      .catch(() => undefined);
    queryClient.clear();
    router.replace("/");
    router.refresh();
  };

  return (
    <Button variant={variant} size={size} className={className} loading={pending} onClick={() => void signOut()}>
      {pending ? null : <LogOut className="size-4" aria-hidden />}
      Sign out
    </Button>
  );
}
