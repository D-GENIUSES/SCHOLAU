import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-8 sm:py-12">
      <Link href="/" aria-label="ScholAu home" className="mb-6 rounded-control">
        <Logo />
      </Link>
      <main id="main" tabIndex={-1} className="w-full max-w-md">
        <div className="rounded-card border border-line bg-surface-card p-5 shadow-card sm:p-8">{children}</div>
      </main>
      <footer className="mt-6 text-sm text-ink-muted">
        <Link href="/privacy" className="underline-offset-4 hover:text-ink hover:underline">
          Privacy
        </Link>
      </footer>
    </div>
  );
}
