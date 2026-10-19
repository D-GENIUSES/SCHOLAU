import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { LegalLinks } from "@/components/legal-links";

export const metadata: Metadata = { title: "Privacy Policy" };

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
          <h1 className="text-2xl font-bold lg:text-[32px]">Privacy Policy</h1>
          <p className="text-ink-muted">A plain-language summary of what ScholAu stores and why.</p>
          <p className="text-xs text-ink-muted">Last updated: 19 October 2026</p>
        </div>

        <Section id="what-we-store" title="What we store">
          <ul className="list-disc space-y-1 pl-5">
            <li>Your email address, used to sign in and to send account emails such as confirmation and password reset links.</li>
            <li>Your display name.</li>
            <li>Your username and any profile photo you choose to upload.</li>
            <li>Your signup study details: university, faculty, department and current semester.</li>
            <li>If you set up university courses, your course profile also includes level and academic period to match the published curriculum.</li>
            <li>Your learning and battle activity, such as lessons completed, assessment attempts and battle results.</li>
            <li>Your XP (experience points) and streak.</li>
          </ul>
        </Section>

        <Section id="sign-in" title="Signing in with Google">
          <p>If you choose Google sign-in, Google shares your email address and basic profile information, such as your name and profile picture, with our authentication provider, Supabase. ScholAu uses this information to authenticate your account. ScholAu does not receive your Google password or request access to your Gmail messages or Google Drive files.</p>
          <p>You can review or remove the Google connection in your Google Account settings. Removing that connection does not by itself delete your ScholAu account or learning history.</p>
        </Section>

        <Section id="service-providers" title="How data is used and stored">
          <p>We use account and academic details to provide sign-in, match course access and maintain your learning progress. Supabase provides authentication and database services, Vercel hosts the application, and private course or profile assets may be stored through Supabase Storage or Cloudflare R2.</p>
          <p>Session cookies keep you signed in. Browser storage also supports application preferences and notification setup. Course content and account information are subject to the platform’s access controls; administrators and authorized teaching staff have access needed to manage their responsibilities.</p>
        </Section>

        <Section id="notifications" title="Notifications">
          <p>Browser push notifications require your permission. When enabled, we store a device subscription so we can deliver notifications. You can manage notifications in the app and revoke permission in your browser settings. In-app notifications remain part of your account.</p>
        </Section>

        <Section id="analytics" title="Analytics">
          <p>
            Application analytics are designed to use minimal events tied to an opaque identifier. Analytics events do not include your
            answer text, your email address, your name or other personal information.
          </p>
          <p>We do not use session replay.</p>
        </Section>

        <Section id="leaderboards" title="Leaderboards">
          <p>
            Leaderboards show your public username and lifetime XP. You can hide yourself using the leaderboard visibility setting in your Profile. Your detailed XP history remains private.
          </p>
        </Section>

        <Section id="deletion" title="Deleting your account">
          <p>
            You can request account deletion from your Profile. Requests are handled by our support team, who will confirm with
            you once your account has been deleted.
          </p>
        </Section>

        <Section id="contact" title="Contact">
          <p>For privacy or support questions, email <a href="mailto:johnnwaokolo01@gmail.com" className="font-semibold text-brand-primary underline">johnnwaokolo01@gmail.com</a>. Signed-in users can also use Contact support in Profile → Settings → Support &amp; privacy.</p>
          <p>Account data is retained while needed to operate your account and handle support requests. You can request deletion from your Profile. Changes to this policy will appear on this page with an updated date.</p>
        </Section>

        <p>
          <Link href="/" className="font-semibold text-brand-primary underline-offset-4 hover:underline">
            Back to ScholAu
          </Link>
        </p>
      </main>
      <footer className="border-t border-line px-4 py-6"><LegalLinks /></footer>
    </div>
  );
}
