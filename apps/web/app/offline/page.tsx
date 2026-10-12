import { WifiOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { COPY } from "@scholau/core";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo />
      <span className="inline-flex size-12 items-center justify-center rounded-pill bg-warning-bg text-warning" aria-hidden>
        <WifiOff className="size-6" />
      </span>
      <h1 className="text-2xl font-bold">You&apos;re offline</h1>
      <p className="text-ink-muted">{COPY.empty.offline}</p>
      <p className="text-ink-muted">Battles need a live connection, so they aren&apos;t available while you&apos;re offline.</p>
      <Button asChild>
        <Link href="/home">Try again</Link>
      </Button>
    </main>
  );
}
