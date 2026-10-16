"use client";
import { ArrowLeft, CheckCircle2, ChevronRight, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ContinueLearningCard, HowItWorks, QuickActions } from "@/components/home/learning-panels";
import { BattleCard } from "@/components/home/side-panels";
import { ShellFrame } from "@/components/shell/shell-frame";
import { SplashGate } from "@/components/shell/splash-gate";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/misc";
import { practiceQuestions, sampleCourses, starterLesson } from "./guest-content";

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
    case "practice": content = <GuestPractice />; break;
    case "battles": content = <GuestBattles />; break;
    case "mock": content = <AccountPrompt title="Mock exams" description="Sign in to try timed assessments and track your results." next="/study" />; break;
    case "leaderboard": content = <AccountPrompt title="Leaderboard" description="Join ScholAu to earn 10 welcome XP and see where you rank on the leaderboard." next="/leaderboard" />; break;
    case "profile": content = <AccountPrompt title="Your profile" description="Sign in to view your progress and account details." next="/profile" />; break;
  }

  return <SplashGate><ShellFrame guest pathname={pathname}>{content}</ShellFrame></SplashGate>;
}

function GuestHeader({ title, description }: { title: string; description: string }) {
  return <div className="home-welcome"><div><h1>{title}</h1><p>{description}</p></div></div>;
}

function GuestHome() {
  return (
    <div className="home-dashboard">
      <div className="home-welcome">
        <div><h1>Try ScholAu</h1><p>Read a sample lesson or answer practice questions. No account needed.</p></div>
      </div>
      <div className="home-columns">
        <div className="home-primary">
          <ContinueLearningCard item={starterLesson} firstLesson preview href="/home?view=lesson" />
          <QuickActions guest />
          <div className="lg:hidden"><BattleCard live={null} guest /></div>
          <SampleCourses compact />
        </div>
        <aside aria-label="More ways to learn" className="home-secondary">
          <div className="hidden lg:block"><BattleCard live={null} guest /></div>
          <section className="study-note" aria-labelledby="guest-account-title">
            <h2 id="guest-account-title">With an account</h2>
            <ul className="account-benefits"><li>Access your assigned courses</li><li>Save lessons and test results</li><li>Track XP and join quiz battles</li></ul>
            <Button asChild variant="outline" size="sm" className="mt-5"><Link href="/sign-up">Create account</Link></Button>
          </section>
          <div className="guest-note"><p>Sign in to save progress and join battles.</p></div>
        </aside>
      </div>
    </div>
  );
}

function SampleCourses({ compact = false }: { compact?: boolean }) {
  return (
    <section aria-labelledby="sample-courses-title">
      <div className="section-heading">
        <h2 id="sample-courses-title">{compact ? "Sample lessons" : "General knowledge"}</h2>
        {compact ? <Link href="/home?view=study">View all <ChevronRight className="size-4" aria-hidden /></Link> : <span className="text-xs text-ink-muted">Free samples</span>}
      </div>
      <ul className="course-list sample-course-grid">
        {sampleCourses.map((course, index) => (
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
    <div className="lesson-finish"><div><h2>Practice questions</h2><p>Try three general knowledge questions with instant feedback. No account needed.</p></div></div><Button asChild ><Link href="/home?view=practice">Try the practice test </Link></Button><p className="text-sm text-ink-muted">Sign in to save progress and earn XP from account activities.</p>
  </div>;
}
function GuestPractice() {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const q = practiceQuestions[index] ?? practiceQuestions[0];
  function check() { if (selected === null || checked) return; if (selected === q.correct) setScore((n) => n + 1); setChecked(true); }
  function next() { if (index === practiceQuestions.length - 1) setFinished(true); else { setIndex((n) => n + 1); setSelected(null); setChecked(false); } }
  return <div className="guest-reading"><Link href="/home" className="back-link"><ArrowLeft className="size-4" aria-hidden />Back to Home</Link><p className="content-label">General knowledge practice</p><h1>{finished ? "Practice results" : "Practice test"}</h1><p className="reading-lead">Answer three questions and review the explanations.</p>
    {finished ? <div className="practice-result"><h2>{score} of {practiceQuestions.length} correct</h2><p>{score === practiceQuestions.length ? "You answered every question correctly." : "Review the explanations or try the test again."}</p><div className="flex flex-wrap gap-3"><Button onClick={() => { setIndex(0); setSelected(null); setChecked(false); setScore(0); setFinished(false); }} variant="outline" >Try again</Button><Button asChild ><Link href="/sign-up">Create account </Link></Button></div></div> : <div className="practice-card"><div className="flex items-center justify-between gap-4 text-sm text-ink-muted"><span>Question {index + 1} of {practiceQuestions.length}</span><span>Untimed</span></div><Progress value={100 * (index + (checked ? 1 : 0)) / practiceQuestions.length} label="Sample practice progress" className="h-1.5" /><fieldset disabled={checked}><legend className="practice-question">{q.prompt}</legend><div className="practice-options">{q.options.map((option, i) => <label key={option} className={`practice-option${selected === i ? " selected" : ""}${checked && i === q.correct ? " correct" : checked && selected === i ? " incorrect" : ""}`}><input type="radio" name={`question-${index}`} checked={selected === i} onChange={() => setSelected(i)} /><span>{option}</span>{checked && i === q.correct ? <CheckCircle2 className="size-5 shrink-0" aria-hidden /> : null}</label>)}</div></fieldset>{checked ? <div className={`practice-feedback ${selected === q.correct ? "correct" : "incorrect"}`} role="status">{selected === q.correct ? <CheckCircle2 className="size-5 shrink-0" aria-hidden /> : <XCircle className="size-5 shrink-0" aria-hidden />}<div><strong>{selected === q.correct ? "Correct" : "Incorrect"}</strong><p>{q.explanation}</p></div></div> : null}<Button onClick={checked ? next : check} disabled={!checked && selected === null} className="self-start">{checked ? index === practiceQuestions.length - 1 ? "See results" : "Next question" : "Check answer"}</Button></div>}
    <p className="text-sm text-ink-muted">Guest practice is not saved and does not award account XP. You can replay it freely.</p>
  </div>;
}
function GuestBattles() {
  return <div className="guest-battles"><GuestHeader title="Battles" description="Play a quiz against another player and earn XP." /><div className="battle-intro"><div><h2>1v1 quiz battles</h2><p>Test what you know against another player.<br />Earn XP for correct answers and match results.</p><Button asChild ><Link href="/sign-in?next=%2Fbattles">Sign in to battle </Link></Button></div></div><div className="battle-reward-grid">{[{ value: "Unlimited battles", label: "No daily match limit" }, { value: "Up to 15 XP", label: "2 per correct answer · Win +5 · Draw +2" }, { value: "5 questions", label: "20 seconds per question" }].map(({ value, label }) => <div key={value}><strong>{value}</strong><p>{label}</p></div>)}</div><p className="guest-note">XP applies to your first 10 completed matches daily, at most 2 per opponent. Resets at midnight Africa/Lagos. Cancelled and forfeited matches award no XP.</p></div>;
}
function AccountPrompt({ title, description, next }: { title: string; description: string; next: string }) {
  return <div className="account-prompt"><h1>{title}</h1><p>{description}</p><div className="flex flex-wrap justify-center gap-3"><Button asChild ><Link href={`/sign-in?next=${encodeURIComponent(next)}`}>Sign in </Link></Button><Button asChild variant="outline" ><Link href="/sign-up">Create account</Link></Button></div><Link href="/home?view=lesson" className="back-link">Try a free lesson first </Link></div>;
}
