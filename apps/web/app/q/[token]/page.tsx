import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedStudyPlayer } from "@/components/shared-study-player";
import { SITE_URL } from "@/lib/seo";
import { studyInvitation } from "@/lib/shared-study";
import { getSharedStudyQuestion } from "@/lib/shared-study-server";
import { getServerSupabase } from "@/lib/supabase/server";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ report?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const question = await getSharedStudyQuestion(token);
  const robots = { index: false, follow: false };
  if (!question) return { title: "Question unavailable", robots };
  const title = question.topic ? `Can you solve this? · ${question.topic}` : "Can you solve this?";
  const description = studyInvitation(question.topic);
  const url = `${SITE_URL}/q/${token}`;
  const images = [{ url: "/icons/app-white-on-blue-v1-512.png", width: 512, height: 512, alt: "ScholAu" }];
  return {
    title,
    description,
    robots,
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: "ScholAu", url, title, description, images },
    twitter: { card: "summary", title, description, images },
  };
}

export default async function SharedStudyPage({ params, searchParams }: Props) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const [question, supabase] = await Promise.all([getSharedStudyQuestion(token), getServerSupabase()]);
  if (!question) notFound();
  const { data } = await supabase.auth.getClaims();
  const host = process.env.NODE_ENV === "development" ? (await headers()).get("host") : null;
  const origin = host ? `http://${host}` : SITE_URL;
  const signInHref = data?.claims.sub ? undefined : `/sign-in?next=${encodeURIComponent(`/q/${token}?report=1`)}`;

  return (
    <main id="main" className="min-h-dvh bg-surface-page px-4 py-8 sm:py-14">
      <div className="mx-auto flex max-w-xl flex-col gap-5">
        <Link href="/home" className="self-start text-lg font-bold text-brand-primary">ScholAu</Link>
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Think you can get this one right?</h1>
          <p className="mt-2 text-sm text-ink-muted">Try one question and see the explanation after you answer.</p>
        </header>
        <SharedStudyPlayer
          key={token}
          question={question}
          token={token}
          link={{ url: `${origin}/q/${token}`, topic: question.topic }}
          signInHref={signInHref}
          startReport={query.report === "1" && !signInHref}
        />
      </div>
    </main>
  );
}