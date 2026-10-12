import { BookOpen, CheckCircle2, ClipboardCheck, GraduationCap, Info, Swords, UserPlus } from "lucide-react";
import Link from "next/link";
import { COPY } from "@scholau/core";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

const VALUE = [
  {
    icon: BookOpen,
    title: "Study your actual courses",
    body: "Short lessons built around the university courses you're taking this semester.",
  },
  {
    icon: CheckCircle2,
    title: "Practise with instant feedback",
    body: "Review questions explain the right answer as soon as you check, so you learn while you practise.",
  },
  {
    icon: ClipboardCheck,
    title: "Mock exams",
    body: "Timed mock exams help you check your readiness before the real thing.",
  },
  {
    icon: Swords,
    title: "Unlimited 1v1 quiz battles",
    body: COPY.battle.unlimited,
  },
] as const;

const STEPS = [
  { icon: UserPlus, title: "Create your account", body: "Sign up with your email and confirm your address." },
  { icon: GraduationCap, title: "Add your academic details", body: "Choose your university, department, level and semester." },
  { icon: BookOpen, title: "Pick your courses and start", body: "Enroll in your courses, study lessons, practise, and battle." },
] as const;

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-surface-card">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-2 px-4 md:px-6">
          <Link href="/" aria-label="ScholAu home" className="shrink-0 rounded-control">
            <Logo className="max-[359px]:[&>span:last-child]:sr-only" />
          </Link>
          <nav aria-label="Account" className="flex items-center gap-1 sm:gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/sign-up">Start learning</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="flex-1">
        <section aria-labelledby="hero-title" className="bg-surface-card">
          <div className="mx-auto flex max-w-content flex-col items-start gap-5 px-4 py-12 md:px-6 md:py-20">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-primary">For university students</p>
            <h1 id="hero-title" className="max-w-reading text-[32px] font-extrabold leading-tight md:text-5xl">
              {COPY.tagline}
            </h1>
            <p className="max-w-reading text-lg text-ink-muted">
              ScholAu helps you study the courses you&apos;re actually taking, practise with instant feedback, sit mock exams and
              challenge classmates to quick 1v1 quiz battles.
            </p>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Button asChild size="lg">
                <Link href="/sign-up">Start learning</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/sign-in">I already have an account</Link>
              </Button>
            </div>
          </div>
        </section>

        <section aria-labelledby="value-title" className="mx-auto max-w-content px-4 py-12 md:px-6">
          <h2 id="value-title" className="mb-6 text-2xl font-bold md:text-[32px]">
            What you can do
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {VALUE.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4 rounded-card border border-line bg-surface-card p-5 shadow-card">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-pill bg-surface-tint text-brand-primary" aria-hidden>
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold">{title}</h3>
                  <p className="text-ink-muted">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="how-title" className="bg-surface-card">
          <div className="mx-auto max-w-content px-4 py-12 md:px-6">
            <h2 id="how-title" className="mb-6 text-2xl font-bold md:text-[32px]">
              How it works
            </h2>
            <ol className="grid gap-4 md:grid-cols-3">
              {STEPS.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="flex flex-col gap-3 rounded-card border border-line p-5">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex size-10 items-center justify-center rounded-pill bg-brand-primary font-bold text-ink-inverse" aria-hidden>
                      {i + 1}
                    </span>
                    <Icon className="size-5 text-brand-primary" aria-hidden />
                  </div>
                  <h3 className="text-lg font-bold">
                    <span className="sr-only">Step {i + 1}: </span>
                    {title}
                  </h3>
                  <p className="text-ink-muted">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="pilot-title" className="mx-auto max-w-content px-4 py-12 md:px-6">
          <div className="flex gap-3 rounded-card border border-[#cfe3fb] bg-surface-tint p-5">
            <Info className="mt-0.5 size-5 shrink-0 text-brand-primary" aria-hidden />
            <div className="flex flex-col gap-1">
              <h2 id="pilot-title" className="text-lg font-bold">
                Pilot availability
              </h2>
              <p>ScholAu is in a pilot with selected courses. If your course isn&apos;t available yet, you can still sign up.</p>
            </div>
          </div>
          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg">
              <Link href="/sign-up">Start learning</Link>
            </Button>
            <Link href="/privacy" className="font-semibold text-brand-primary underline-offset-4 hover:underline">
              How we handle your data
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface-card">
        <div className="mx-auto flex max-w-content flex-col gap-3 px-4 py-6 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between md:px-6">
          <p>ScholAu · {COPY.tagline}</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:text-ink hover:underline">
              Privacy
            </Link>
            <Link href="/privacy#contact" className="hover:text-ink hover:underline">
              Contact
            </Link>
            <Link href="/sign-in" className="hover:text-ink hover:underline">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
