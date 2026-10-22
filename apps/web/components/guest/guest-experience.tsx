"use client";
import { ArrowLeft, BookOpen, ClipboardCheck, Swords, Trophy, ChevronRight } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { type ReactNode } from "react";
import { ContinueLearningCard, HowItWorks } from "@/components/home/learning-panels";
import { ShellFrame } from "@/components/shell/shell-frame";
import { Button } from "@/components/ui/button";
import { sampleCourses, starterLesson } from "./guest-content";

// Keep the question bank out of the initial guest dashboard download.
const MaterialQuiz = dynamic(() => import("./material-quiz").then((module) => module.MaterialQuiz), {
  loading: () => <p role="status" className="text-sm text-ink-muted">Loading practice questions…</p>,
});

const VIEWS = ["home", "study", "battles", "leaderboard", "profile", "lesson", "practice", "mock"] as const;
type View = typeof VIEWS[number];

export function GuestExperience() {
  const params = useSearchParams();
  const requested = params.get("view");
  const view: View = VIEWS.find((option) => option === requested) ?? "home";
  const pathname = view === "lesson" || view === "practice" || view === "mock" ? "/study" : `/${view}`;
  let content: ReactNode;

  switch (view) {
    case "home": content = <GuestHome />; break;
    case "study":
      content = <><GuestHeader title="Study" description="Read a sample lesson or take a general knowledge test." /><SampleCourses /><div className="mt-6"><HowItWorks guest /></div></>;
      break;
    case "lesson": content = <GuestLesson />; break;
    case "practice": content = <MaterialQuiz />; break;
    case "battles": content = <GuestBattles />; break;
    case "mock": content = <AccountPrompt title="Mock exams" description="Sign in to try timed assessments and track your results." next="/study" />; break;
    case "leaderboard": content = <AccountPrompt title="Leaderboard" description="Join ScholAu to earn 10 welcome XP and see where you rank on the leaderboard." next="/leaderboard" />; break;
    case "profile": content = <AccountPrompt title="Your profile" description="Sign in to view your progress and account details." next="/profile" />; break;
  }

  return <ShellFrame guest pathname={pathname}>{content}</ShellFrame>;
}

function GuestHeader({ title, description }: { title: string; description: string }) {
  return <div className="home-welcome"><div><h1>{title}</h1><p>{description}</p></div></div>;
}

function GuestHome() {
  const actions = [
    { label: "Sample courses", href: "/home?view=study", icon: BookOpen },
    { label: "Practice", href: "/home?view=practice", icon: ClipboardCheck },
    { label: "Quiz battles", href: "/home?view=battles", icon: Swords },
    { label: "Leaderboard", href: "/home?view=leaderboard", icon: Trophy },
  ];
  return <div className="home-dashboard compact-home">
    <div className="home-welcome"><div><h1>Try ScholAu</h1><p>Start with a free sample lesson.</p></div></div>
    <div className="compact-home-grid"><div className="compact-home-main">
      <ContinueLearningCard item={starterLesson} firstLesson preview href="/home?view=lesson" />
      <nav className="home-action-grid" aria-label="Learning shortcuts">{actions.map(({ label, href, icon: Icon }) => <Link key={label} href={href} className="home-action-tile"><span className="tile-icon"><Icon size={23} aria-hidden /></span><strong>{label}</strong></Link>)}</nav>
    </div><aside className="compact-home-aside" aria-label="Sample courses"><SampleCourses compact /><section className="study-note"><h2>Save your progress</h2><p className="mt-2 text-sm text-ink-muted">Create an account to access your courses, earn XP and join battles.</p><Button asChild size="sm" className="mt-3"><Link href="/sign-up">Create account</Link></Button></section></aside></div>
  </div>;
}

function SampleCourses({ compact = false }: { compact?: boolean }) {
  return (
    <section aria-labelledby="sample-courses-title">
      <div className="section-heading">
        <h2 id="sample-courses-title">{compact ? "Sample lessons" : "General knowledge"}</h2>
        {compact ? <Link href="/home?view=study">View all <ChevronRight className="size-4" aria-hidden /></Link> : <span className="text-xs text-ink-muted">Free samples</span>}
      </div>
      <ul className="course-list sample-course-grid">
        {(compact ? sampleCourses.slice(0, 2) : sampleCourses).map((course, index) => (
          <li key={course.title}>
            <Link href={`/home?view=lesson&topic=${index}`} className="course-row">
              <span className="course-info"><strong>{course.title}</strong><small>{course.description}</small><span className="course-preview-label">Free sample lesson</span></span>
              <ChevronRight className="size-4 shrink-0 text-ink-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function GuestLesson() {
  const params = useSearchParams();
  const topic = Number(params.get("topic"));
  const lessons = [
    { title: "Why is Mars called the Red Planet?", heading: "A planet with a distinctive colour", body: "Mars is known as the Red Planet. Iron oxide on its surface gives it a reddish appearance. The same kind of chemical change gives iron rust its familiar colour." },
    { title: "What makes a triangle a triangle?", heading: "Three sides and three corners", body: "A triangle has three straight sides and three corners. It can be tall, wide, small, or turned in any direction. Its size and orientation do not change the number of sides." },
    { title: "Discover Earth’s oceans", heading: "A world of water", body: "Oceans are vast bodies of salt water. Earth has five named oceans: the Pacific, Atlantic, Indian, Southern, and Arctic. The Pacific is the largest." },
  ];
  const selected = params.has("topic") && Number.isInteger(topic) ? lessons[topic] : undefined;
  const visibleLessons = selected ? [selected] : lessons;
  return <div className="guest-reading"><Link href="/home" className="back-link"><ArrowLeft className="size-4" aria-hidden />Back to Home</Link><p className="content-label">Sample lesson</p><h1>{selected?.title ?? "General knowledge"}</h1><p className="reading-lead">Three short lessons on science, mathematics, and geography.</p>
    
    {visibleLessons.map((lesson) => <section key={lesson.title} className="flex flex-col gap-3"><h2>{lesson.heading}</h2><p className="text-ink-muted leading-8">{lesson.body}</p></section>)}
    <div className="lesson-finish"><div><h2>Practice questions</h2><p>Try five simple general knowledge questions with instant feedback. No account needed.</p></div></div><Button asChild ><Link href="/home?view=practice">Try the practice test </Link></Button><p className="text-sm text-ink-muted">Sign in to save progress and earn XP from account activities.</p>
  </div>;
}
function GuestBattles() {
  return <div className="guest-battles"><GuestHeader title="Battles" description="Play a quiz against another player and earn XP." /><div className="battle-intro"><div><h2>1v1 quiz battles</h2><p>Test what you know against another player.<br />Earn XP for correct answers and match results.</p><Button asChild ><Link href="/sign-in?next=%2Fbattles">Sign in to battle </Link></Button></div></div><div className="battle-reward-grid">{[{ value: "Unlimited battles", label: "No daily match limit" }, { value: "2 XP per correct answer", label: "Both players earn XP · Win +20 · No draw bonus" }, { value: "5 questions", label: "20 seconds per question" }].map(({ value, label }) => <div key={value}><strong>{value}</strong><p>{label}</p></div>)}</div><p className="guest-note">XP applies to your first 10 completed matches daily, at most 2 per opponent. Resets at midnight Africa/Lagos. Cancelled and forfeited matches award no XP.</p></div>;
}
function AccountPrompt({ title, description, next }: { title: string; description: string; next: string }) {
  return <div className="account-prompt"><h1>{title}</h1><p>{description}</p><div className="flex flex-wrap justify-center gap-3"><Button asChild ><Link href={`/sign-in?next=${encodeURIComponent(next)}`}>Sign in </Link></Button><Button asChild variant="outline" ><Link href="/sign-up">Create account</Link></Button></div><Link href="/home?view=lesson" className="back-link">Try a free lesson first </Link></div>;
}
