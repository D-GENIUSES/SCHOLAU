"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

function clientReference(): string {
  return `SA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [reference] = useState(() => error.digest ?? clientReference());

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" tabIndex={-1} className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo />
      <div role="alert" className="flex flex-col items-center gap-3">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="text-ink-muted">This page hit an unexpected problem. Your saved progress is not affected. Please try again.</p>
        <p className="text-sm text-ink-muted">Reference: {reference}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RefreshCw className="size-4" aria-hidden /> Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/home">Go to Home</Link>
        </Button>
      </div>
    </main>
  );
}
