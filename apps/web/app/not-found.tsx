import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <Link href="/" aria-label="ScholAu home" className="rounded-control">
        <Logo />
      </Link>
      <h1 className="text-2xl font-bold">We couldn&apos;t find that page</h1>
      <p className="text-ink-muted">The link may be broken, or the page may have moved.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/home">Go to Home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">ScholAu start page</Link>
        </Button>
      </div>
    </main>
  );
}
