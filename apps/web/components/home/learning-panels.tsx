import { ArrowRight, BookOpen, CheckCircle2, ChevronRight, ClipboardCheck, Clock, FileCheck2, Swords } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { HomeSummary } from "@scholau/api";
import { type ActivityKind, formatRelative, formatXpDelta, pluralize } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
type Continue = NonNullable<HomeSummary["continue_learning"]>;
type Course = HomeSummary["enrolled_courses"][number];
export function ContinueLearningCard({ item, firstLesson, course, href, preview = false }: { item: Continue | null; firstLesson: boolean; course?: Course; href?: string; preview?: boolean }) {
  const percent = course && course.lessons_total > 0 ? Math.round(100 * course.lessons_completed / course.lessons_total) : null;
  return <section className="learning-spotlight" aria-labelledby="continue-title"><div className="spotlight-content">
    <p className="eyebrow spotlight-label">{preview ? "TRY A FREE LESSON" : firstLesson ? "YOUR FIRST LESSON" : item ? "CONTINUE LEARNING" : "NICE WORK"}</p>
    <h2 id="continue-title">{item?.course_title ?? "You’re all caught up"}</h2><p className="spotlight-description">{preview ? "Recognize threats. Protect your digital world." : item?.title ?? "Explore your courses or test what you’ve learned."}</p>
    {percent !== null && course ? <div className="spotlight-progress"><div className="flex items-center gap-3"><Progress value={percent} label={`${course.title} progress`} className="bg-white/65" /><span className="text-sm font-bold">{percent}%</span></div><p>{course.lessons_completed} of {pluralize(course.lessons_total, "lesson")} completed</p></div> : item ? <p className="spotlight-time"><Clock className="size-4" aria-hidden />{pluralize(item.estimated_minutes, "minute")}<span aria-hidden>·</span>{preview ? "No account needed" : item.kind === "resume" ? "In progress" : "At your own pace"}</p> : null}
    <Button asChild className="rounded-pill self-start shadow-[0_5px_14px_#0066d620]" size="sm"><Link href={href ?? (item ? `/study/lessons/${item.lesson_id}` : "/study")}>{preview ? "Start learning" : !item ? "Go to Study" : firstLesson ? "Start lesson" : item.kind === "resume" ? "Continue lesson" : "Start next lesson"}<ArrowRight className="size-4" aria-hidden /></Link></Button>
  </div><Image src="/illustrations/learning-shield.webp" alt="" width={512} height={512} sizes="(max-width: 639px) 160px, 260px" className="spotlight-art" preload /></section>;
}
export function QuickActions({ offeringId, guest = false }: { offeringId?: string; guest?: boolean }) {
  const base = offeringId ? `/study/courses/${offeringId}` : "/study";
  const actions = [
    { icon: ClipboardCheck, label: "Practice test", description: "Check what you know", href: guest ? "/home?view=practice" : `${base}${offeringId ? "#practice" : ""}` },
    { icon: FileCheck2, label: "Mock exam", description: "Get ready for the real thing", href: guest ? "/home?view=mock" : `${base}${offeringId ? "#mock" : ""}` },
  ];
  return <section aria-labelledby="quick-title"><h2 id="quick-title" className="section-title">Quick actions</h2><div className="quick-actions">{actions.map(({ icon: Icon, label, description, href }) => <Link key={label} href={href} className="quick-action"><span className="icon-tile"><Icon className="size-5" aria-hidden /></span><span><strong>{label}</strong><small>{description}</small></span><ChevronRight className="size-4 action-chevron" aria-hidden /></Link>)}</div></section>;
}
export function HowItWorks() {
  const items = [{ icon: BookOpen, title: "Study", body: "Short lessons. Clear explanations. Your university courses." }, { icon: ClipboardCheck, title: "Practice", body: "Test your understanding and prepare with mock exams." }, { icon: Swords, title: "Compete", body: "Unlimited 1v1 battles. XP for every completed match." }];
  return <section aria-labelledby="how-title"><h2 id="how-title" className="section-title">Your path to progress</h2><ul className="grid gap-3 sm:grid-cols-3">{items.map(({ icon: Icon, title, body }) => <li key={title} className="how-card"><Icon className="size-5 text-brand-primary" aria-hidden /><h3>{title}</h3><p>{body}</p></li>)}</ul></section>;
}
export function CourseProgressList({ courses }: { courses: HomeSummary["enrolled_courses"] }) {
  return <section aria-labelledby="courses-title"><div className="section-heading"><h2 id="courses-title">Your courses</h2><Link href="/study">View all <ChevronRight className="size-4" aria-hidden /></Link></div><ul className="course-list">{courses.slice(0, 4).map((c, i) => {
    const percent = c.lessons_total > 0 ? Math.round(100 * c.lessons_completed / c.lessons_total) : 0;
    return <li key={c.offering_id}><Link href={`/study/courses/${c.offering_id}`} className="course-row"><span className={`course-tile course-tile-${i % 3}`}><BookOpen className="size-6" aria-hidden /></span><span className="course-info"><strong>{c.title}</strong><small>{c.code} <span aria-hidden>·</span> {c.lessons_completed} of {pluralize(c.lessons_total, "lesson")}</small><span className="flex items-center gap-3"><Progress value={percent} label={`${c.code} progress`} tone={percent >= 100 ? "success" : "brand"} className="h-1.5" /><span className="text-xs text-ink-muted">{percent}%</span></span></span><ChevronRight className="size-4 shrink-0 text-ink-muted" aria-hidden /></Link></li>;
  })}</ul></section>;
}
const ACTIVITY: Record<ActivityKind, { label: string; icon: typeof BookOpen }> = { lesson_completed: { label: "Lesson completed", icon: BookOpen }, assessment_completed: { label: "Assessment completed", icon: ClipboardCheck }, battle_completed: { label: "Battle completed", icon: Swords } };
export function RecentActivity({ items }: { items: HomeSummary["recent_activity"] }) {
  return <section aria-labelledby="activity-title"><h2 id="activity-title" className="section-title">Recent activity</h2>{items.length === 0 ? <EmptyState icon={<CheckCircle2 className="size-6" />} title="A fresh start" description="Your completed lessons, tests, and battles will appear here. Every step counts." /> : <ul className="activity-list">{items.map((a) => { const { label, icon: Icon } = ACTIVITY[a.kind]; return <li key={`${a.kind}-${a.source_id}`}><span className="icon-tile"><Icon className="size-5" aria-hidden /></span><span className="min-w-0 flex-1"><strong>{label}</strong><time dateTime={a.created_at}>{formatRelative(a.created_at)}</time></span><span className="activity-xp">{formatXpDelta(a.xp)}</span></li>; })}</ul>}</section>;
}
