import Link from "next/link";

export default function SharedQuestionUnavailable() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-xl flex-col items-start justify-center gap-4 px-4 py-8">
      <h1 className="text-2xl font-bold">This question is unavailable</h1>
      <p className="text-ink-muted">This link may be incorrect or the question may have been withdrawn.</p>
      <Link href="/home" className="font-semibold text-brand-primary underline">Keep practising on ScholAu</Link>
    </main>
  );
}