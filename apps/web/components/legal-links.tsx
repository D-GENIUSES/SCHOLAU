import Link from "next/link";

export function LegalLinks() {
  return <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-ink-muted">
    <Link href="/privacy" className="rounded-control underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-primary">Privacy Policy</Link>
    <Link href="/terms" className="rounded-control underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-primary">Terms of Use</Link>
  </nav>;
}
