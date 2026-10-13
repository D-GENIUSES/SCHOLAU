"use client";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ChevronRight, Shapes, Globe, Leaf, GraduationCap, Infinity as InfinityIcon, ShieldCheck, Swords, Trophy, UserRound, XCircle, Zap } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ContinueLearningCard, HowItWorks, QuickActions } from "@/components/home/learning-panels";
import { BattleCard, StatsPanel } from "@/components/home/side-panels";
import { ShellFrame } from "@/components/shell/shell-frame";
import { SplashGate } from "@/components/shell/splash-gate";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/misc";
import { practiceQuestions, sampleCourses, starterLesson } from "./guest-content";

const VIEWS = ["home", "study", "battles", "leaderboard", "profile", "lesson", "practice", "mock"] as const;
type View = typeof VIEWS[number];
const icons = { shield: Leaf, code: Shapes, web: Globe };

export function GuestExperience() {
  const params = useSearchParams();
  const requested = params.get("view");
  const view: View = VIEWS.find((v) => v === requested) ?? "home";
  const pathname = view === "lesson" || view === "practice" || view === "mock" ? "/study" : `/${view}`;
  return <SplashGate><ShellFrame guest pathname={pathname}>
    {view === "home" ? <GuestHome /> : view === "study" ? <><GuestHeader title="Make room for discovery." description="Explore general knowledge at your own pace. No background or account required." /><SampleCourses /><div className="mt-6"><HowItWorks guest /></div></> : view === "lesson" ? <GuestLesson /> : view === "practice" ? <GuestPractice /> : view === "battles" ? <GuestBattles /> : view === "mock" ? <AccountPrompt icon={BookOpen} title="Get ready for the real thing." description="Sign in to try timed assessments and track your results." next="/study" /> : view === "leaderboard" ? <AccountPrompt icon={Trophy} title="A little progress. A higher place." description="Earn XP through learning and unlimited quiz battles. Sign in to explore rankings and track your achievements." next="/leaderboard" /> : <AccountPrompt icon={UserRound} title="Make this space yours." description="Save your progress, build your streak, and keep your achievements in one place." next="/profile" />}
  </ShellFrame></SplashGate>;
}
function GuestHeader({ title, description }: { title: string; description: string }) {
  return <div className="home-welcome"><div><p className="eyebrow hidden lg:block">YOUR LEARNING SPACE</p><h1>{title}</h1><p>{description}</p></div></div>;
}
function GuestHome() {
  return <div className="home-dashboard"><div className="home-welcome"><div><p className="eyebrow hidden lg:block">YOUR LEARNING SPACE</p><h1>Welcome to <span>ScholAu.</span></h1><p>Keep learning. Build your future.</p></div><StatsPanel summary={{ xp_total: 0, streak: { current: 0, longest: 0, active_today: false, local_date: "" } }} /></div>
    <div className="home-columns"><div className="home-primary"><ContinueLearningCard item={starterLesson} firstLesson preview href="/home?view=lesson" /><QuickActions guest /><div className="lg:hidden"><BattleCard live={null} guest /></div><SampleCourses compact /><section aria-labelledby="guest-activity"><h2 id="guest-activity" className="section-title">Your journey starts here</h2><div className="guest-progress"><span className="icon-tile"><GraduationCap className="size-6" aria-hidden /></span><div><h3>A fresh start. A world of possibilities.</h3><p>Try a lesson now. Create an account when you’re ready to save your progress.</p></div><Link href="/sign-up" className="guest-progress-link">Get started <ArrowRight className="size-4" aria-hidden /></Link></div></section></div>
      <aside aria-label="More ways to learn" className="home-secondary"><div className="hidden lg:block"><BattleCard live={null} guest /></div><div className="study-note"><span className="icon-tile"><BookOpen className="size-5" aria-hidden /></span><h2>Your curiosity.<br />Your pace.</h2><p>Explore science, everyday numbers, and our world. There is something here for every curious mind.</p><Link href="/home?view=study">Explore learning <ArrowRight className="size-4" aria-hidden /></Link></div><div className="guest-note"><ShieldCheck className="size-4" aria-hidden /><p>Explore freely. Sign in to save progress and compete with other players.</p></div></aside>
    </div></div>;
}
function SampleCourses({ compact = false }: { compact?: boolean }) {
  return <section aria-labelledby="sample-courses-title"><div className="section-heading"><h2 id="sample-courses-title">{compact ? "Explore learning" : "Discover something new"}</h2>{compact ? <Link href="/home?view=study">View all <ChevronRight className="size-4" aria-hidden /></Link> : <span className="text-xs text-ink-muted">Introductory previews</span>}</div><ul className="course-list">{sampleCourses.map((c, i) => { const Icon = icons[c.icon]; return <li key={c.title}><Link href={`/home?view=lesson&topic=${i}`} className="course-row"><span className={`course-tile course-tile-${i}`}><Icon className="size-6" aria-hidden /></span><span className="course-info"><strong>{c.title}</strong><small>{c.description}</small><span className="course-preview-label">Free sample lesson</span></span><ChevronRight className="size-4 shrink-0 text-ink-muted" aria-hidden /></Link></li>; })}</ul></section>;
}
function GuestLesson() {
  const params = useSearchParams();
  const topic = Number(params.get("topic"));
  const lessons = [
    { title: "Why is Mars called the Red Planet?", heading: "A planet with a distinctive colour", body: "Mars is known as the Red Planet. Iron oxide on its surface gives it a reddish appearance. The same kind of chemical change gives iron rust its familiar colour." },
    { title: "What makes a triangle a triangle?", heading: "Three sides, many possibilities", body: "A triangle has three straight sides and three corners. It can be tall, wide, small, or turned in any direction. Its size and orientation do not change the number of sides." },
    { title: "Discover Earth’s oceans", heading: "A world of water", body: "Oceans are vast bodies of salt water. Earth has five named oceans: the Pacific, Atlantic, Indian, Southern, and Arctic. The Pacific is the largest." },
  ];
  const selected = params.has("topic") && Number.isInteger(topic) ? lessons[topic] : undefined;
  const visibleLessons = selected ? [selected] : lessons;
  return <div className="guest-reading"><Link href="/home" className="back-link"><ArrowLeft className="size-4" aria-hidden />Back to Home</Link><p className="eyebrow">FREE SAMPLE · GENERAL KNOWLEDGE</p><h1>{selected?.title ?? "A little curiosity goes a long way."}</h1><p className="reading-lead">Explore everyday ideas about science, numbers, and our world. Everyone can start somewhere.</p>
    <div className="lesson-callout"><Globe className="size-6 text-brand-primary" aria-hidden /><p>You don’t need a particular background to explore these samples. Read, discover something new, and try a few questions at your own pace.</p></div>
    {visibleLessons.map((lesson) => <section key={lesson.title} className="flex flex-col gap-3"><h2>{lesson.heading}</h2><p className="text-ink-muted leading-8">{lesson.body}</p></section>)}
    <div className="lesson-finish"><CheckCircle2 className="size-6 text-brand-primary" aria-hidden /><div><h2>Ready to explore a little further?</h2><p>Try three general knowledge questions with instant feedback. No account needed.</p></div></div><Button asChild className="rounded-pill"><Link href="/home?view=practice">Try the practice test <ArrowRight className="size-4" aria-hidden /></Link></Button><p className="text-sm text-ink-muted">This sample is for exploring ScholAu. Sign in whenever you’re ready to save progress and earn XP.</p>
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
  return <div className="guest-reading"><Link href="/home" className="back-link"><ArrowLeft className="size-4" aria-hidden />Back to Home</Link><p className="eyebrow">FREE PRACTICE · GENERAL KNOWLEDGE</p><h1>{finished ? "A little wiser already." : "Check what you know."}</h1><p className="reading-lead">Three questions. Instant feedback. A small step forward.</p>
    {finished ? <div className="practice-result"><span className="icon-tile"><Trophy className="size-7" aria-hidden /></span><h2>{score} of {practiceQuestions.length} correct</h2><p>{score === practiceQuestions.length ? "Great start! Keep discovering new things." : "Every answer is a chance to learn. Give it another go whenever you like."}</p><div className="flex flex-wrap gap-3"><Button onClick={() => { setIndex(0); setSelected(null); setChecked(false); setScore(0); setFinished(false); }} variant="outline" className="rounded-pill">Try again</Button><Button asChild className="rounded-pill"><Link href="/sign-up">Save your next steps <ArrowRight className="size-4" aria-hidden /></Link></Button></div></div> : <div className="practice-card"><div className="flex items-center justify-between gap-4 text-sm text-ink-muted"><span>Question {index + 1} of {practiceQuestions.length}</span><span>Untimed</span></div><Progress value={100 * (index + (checked ? 1 : 0)) / practiceQuestions.length} label="Sample practice progress" className="h-1.5" /><fieldset disabled={checked}><legend className="practice-question">{q.prompt}</legend><div className="practice-options">{q.options.map((option, i) => <label key={option} className={`practice-option${selected === i ? " selected" : ""}${checked && i === q.correct ? " correct" : checked && selected === i ? " incorrect" : ""}`}><input type="radio" name={`question-${index}`} checked={selected === i} onChange={() => setSelected(i)} /><span>{option}</span>{checked && i === q.correct ? <CheckCircle2 className="size-5 shrink-0" aria-hidden /> : null}</label>)}</div></fieldset>{checked ? <div className={`practice-feedback ${selected === q.correct ? "correct" : "incorrect"}`} role="status">{selected === q.correct ? <CheckCircle2 className="size-5 shrink-0" aria-hidden /> : <XCircle className="size-5 shrink-0" aria-hidden />}<div><strong>{selected === q.correct ? "That’s right!" : "A chance to learn."}</strong><p>{q.explanation}</p></div></div> : null}<Button onClick={checked ? next : check} disabled={!checked && selected === null} className="rounded-pill self-start">{checked ? index === practiceQuestions.length - 1 ? "See results" : "Next question" : "Check answer"}<ArrowRight className="size-4" aria-hidden /></Button></div>}
    <p className="text-sm text-ink-muted">Guest practice is not saved and does not award account XP. You can replay it freely.</p>
  </div>;
}
function GuestBattles() {
  return <div className="guest-battles"><GuestHeader title="Compete. Learn. Grow." description="A quick challenge. A new perspective. A little more confidence." /><div className="battle-intro"><div><p className="eyebrow">UNLIMITED 1V1 QUIZ BATTLES</p><h2>Your next challenge<br />is waiting.</h2><p>Test what you know against another player.<br />Every completed match earns XP.</p><Button asChild className="rounded-pill"><Link href="/sign-in?next=%2Fbattles">Sign in to battle <ArrowRight className="size-4" aria-hidden /></Link></Button></div><Image unoptimized src="/illustrations/battle-trophy.webp" width={512} height={512} sizes="(max-width: 639px) 170px, 300px" alt="" /></div><div className="battle-reward-grid">{[{ icon: InfinityIcon, value: "No daily limit", label: "Play as often as you like" }, { icon: Zap, value: "XP every match", label: "Win +25 · Draw +10 · Loss +5" }, { icon: Swords, value: "5 questions", label: "20 seconds per question" }].map(({ icon: Icon, value, label }) => <div key={value}><Icon className="size-5 text-brand-primary" aria-hidden /><strong>{value}</strong><p>{label}</p></div>)}</div><p className="guest-note">Completed matches reward both players. Cancelled and forfeited matches do not award XP.</p></div>;
}
function AccountPrompt({ icon: Icon, title, description, next }: { icon: typeof BookOpen; title: string; description: string; next: string }) {
  return <div className="account-prompt"><span className="account-prompt-icon"><Icon className="size-9" aria-hidden /></span><p className="eyebrow">YOUR NEXT CHAPTER</p><h1>{title}</h1><p>{description}</p><div className="flex flex-wrap justify-center gap-3"><Button asChild className="rounded-pill"><Link href={`/sign-in?next=${encodeURIComponent(next)}`}>Sign in <ArrowRight className="size-4" aria-hidden /></Link></Button><Button asChild variant="outline" className="rounded-pill"><Link href="/sign-up">Create account</Link></Button></div><Link href="/home?view=lesson" className="back-link">Try a free lesson first <ArrowRight className="size-4" aria-hidden /></Link></div>;
}
