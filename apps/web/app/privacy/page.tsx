import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Privacy" };

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} id={id} className="flex scroll-mt-6 flex-col gap-2">
      <h2 id={`${id}-title`} className="text-xl font-bold">
        {title}
      </h2>
      <div className="flex flex-col gap-2 text-ink">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-surface-card">
        <div className="mx-auto flex h-16 max-w-reading items-center px-4">
          <Link href="/" aria-label="ScholAu home" className="rounded-control">
            <Logo />
          </Link>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-reading flex-1 flex-col gap-8 px-4 py-8 md:py-12">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold lg:text-[32px]">Privacy summary</h1>
          <p className="text-ink-muted">A plain-language summary of what ScholAu stores and why.</p>
        </div>

        <Section id="what-we-store" title="What we store">
          <ul className="list-disc space-y-1 pl-5">
            <li>Your email address, used to sign in and to send account emails such as confirmation and password reset links.</li>
            <li>Your display name.</li>
            <li>Your signup study details: university, faculty, department and current semester.</li>
            <li>If you set up university courses, your course profile also includes level and academic period to match the published curriculum.</li>
            <li>Your learning and battle activity, such as lessons completed, assessment attempts and battle results.</li>
            <li>Your XP (experience points) and streak.</li>
          </ul>
        </Section>

        <Section id="analytics" title="Analytics">
          <p>
            We measure how the product is used with minimal events tied to an opaque identifier. Analytics never include your
            answer text, your email address, your name or other personal information.
          </p>
          <p>We do not use session replay.</p>
        </Section>

        <Section id="leaderboards" title="Leaderboards">
          <p>
            Leaderboards show your display name and lifetime XP. You can hide yourself using the leaderboard visibility setting in your Profile. Your detailed XP history remains private.
          </p>
        </Section>

        <Section id="deletion" title="Deleting your account">
          <p>
            You can request account deletion from your Profile. Requests are handled by our support team, who will confirm with
            you once your account has been deleted.
          </p>
        </Section>

        <Section id="contact" title="Contact">
          <p>Contact details for privacy and support questions will be published here before the pilot begins.</p>
        </Section>

        <p>
          <Link href="/" className="font-semibold text-brand-primary underline-offset-4 hover:underline">
            Back to ScholAu
          </Link>
        </p>
      </main>
    </div>
  );
}
