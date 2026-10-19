import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { LegalLinks } from "@/components/legal-links";

export function LegalPage({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="flex min-h-dvh flex-col">
    <header className="border-b border-line bg-surface-card"><div className="mx-auto flex h-16 max-w-reading items-center px-4"><Link href="/home" aria-label="ScholAu home" className="rounded-control"><Logo /></Link></div></header>
    <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-reading flex-1 flex-col gap-8 px-4 py-8 md:py-12">
      <div className="flex flex-col gap-2"><h1 className="text-2xl font-bold lg:text-[32px]">{title}</h1><p className="text-ink-muted">{description}</p><p className="text-xs text-ink-muted">Last updated: 19 October 2026</p></div>
      {children}
      <Link href="/home" className="self-start font-semibold text-brand-primary underline-offset-4 hover:underline">Back to ScholAu</Link>
    </main>
    <footer className="border-t border-line px-4 py-6"><LegalLinks /></footer>
  </div>;
}

export function LegalSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-6 flex-col gap-2"><h2 id={`${id}-title`} className="text-xl font-bold">{title}</h2><div className="flex flex-col gap-2 leading-relaxed text-ink">{children}</div></section>;
}
