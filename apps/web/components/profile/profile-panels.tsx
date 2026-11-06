"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Check, ChevronRight, Swords } from "lucide-react";
import { useLearningInsights, useStartTopicReview, useXpProgress } from "@scholau/api/react";
import type { XpProgress } from "@scholau/api";
import { formatDate, formatDateTime, formatXpDelta, XP_BADGES } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { ErrorState, InlineError, LoadingState } from "@/components/ui/states";
import { AchievementMedal } from "@/components/xp/xp-progress";

const activityNames: Record<string, string> = { lesson: "Lesson progress", review: "Topic review", practice: "Practice quiz", mock: "Mock exam", battle: "Quiz battle", signup: "Account created", correction: "XP adjustment" };

export function ProfileOverview() {
  const insights = useLearningInsights();
  const xp = useXpProgress();
  const [activityOpen, setActivityOpen] = useState(false);
  const [strengthsOpen, setStrengthsOpen] = useState(false);
  return <>
    <section aria-labelledby="ps-practice-title"><div className="ps-section-heading"><h2 id="ps-practice-title">Keep practising</h2><span>Based on your results</span></div>
      {insights.isPending ? <p className="ps-muted" role="status">Loading your topics…</p> : insights.isError ? <ErrorState error={insights.error} onRetry={() => void insights.refetch()} /> : <>
        {insights.data.weaknesses.length ? <ul className="ps-topics">{insights.data.weaknesses.slice(0, 3).map(t => <li key={`${t.lesson_id ?? t.course_code}-${t.title}`}><Link href={t.lesson_id ? `/study/lessons/${t.lesson_id}` : "/home"}><div><strong>{t.title}</strong><p>{t.course_code} · {t.accuracy}% accuracy</p></div><ChevronRight aria-hidden /></Link></li>)}</ul> : <p className="ps-muted">{insights.data.strengths.length ? "Keep practising to build on your progress." : "Complete a few topic questions to see what to practise next."}</p>}
        {insights.data.strengths.length ? <details className="ps-details" open={strengthsOpen} onToggle={e => setStrengthsOpen(e.currentTarget.open)}><summary>View strengths</summary><ul className="ps-topics">{insights.data.strengths.map(t => <li key={`${t.lesson_id ?? t.course_code}-${t.title}`}><Link href={t.lesson_id ? `/study/lessons/${t.lesson_id}` : "/home"}><div><strong>{t.title}</strong><p>{t.course_code} · {t.accuracy}% accuracy</p></div><ChevronRight aria-hidden /></Link></li>)}</ul></details> : null}
      </>}
    </section>
    <section aria-labelledby="ps-activity-title"><div className="ps-section-heading"><h2 id="ps-activity-title">Recent activity</h2><Button variant="link" onClick={() => setActivityOpen(v => !v)} aria-expanded={activityOpen} aria-controls="ps-full-activity">{activityOpen ? "Show less" : "View activity"}<ArrowRight aria-hidden /></Button></div>
      {xp.isPending ? <p className="ps-muted" role="status">Loading activity…</p> : xp.isError ? <ErrorState error={xp.error} onRetry={() => void xp.refetch()} /> : <>
        <ActivityList history={xp.data.history.slice(0, activityOpen ? 50 : 3)} />
        {activityOpen ? <div id="ps-full-activity"><WeeklyActivity data={xp.data} /><ScheduledReviews reviews={xp.data.reviews} /></div> : <div id="ps-full-activity" hidden />}
      </>}
    </section>
  </>;
}

function ActivityList({ history }: { history: XpProgress["history"] }) {
  if (!history.length) return <p className="ps-muted">Your learning activity will appear here.</p>;
  return <ul className="ps-activity-list">{history.map(item => <li key={item.id}><span className="ps-activity-icon">{item.activity === "battle" ? <Swords aria-hidden /> : item.activity === "lesson" ? <BookOpen aria-hidden /> : <Check aria-hidden />}</span><div><strong>{activityNames[item.activity] ?? "Learning activity"}</strong><p>{item.reason} · {formatDate(item.date)}</p></div><span className="ps-xp-earned">{formatXpDelta(item.amount)}</span></li>)}</ul>;
}

function WeeklyActivity({ data }: { data: XpProgress }) {
  const key = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  const today = new Date(data.server_time);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today.getTime() - (6 - i) * 86400000);
    return { date, xp: data.history.reduce((sum, award) => key(new Date(award.date)) === key(date) ? sum + Math.max(0, award.amount) : sum, 0) };
  });
  const max = Math.max(1, ...days.map(d => d.xp));
  return <section className="ps-weekly"><h3>Last 7 days</h3><div className="ps-weekly-chart" role="img" aria-label={days.map(d => `${formatDate(d.date.toISOString())}: ${d.xp} XP`).join("; ")}>{days.map(d => <div key={d.date.toISOString()} aria-hidden><div className="ps-weekly-track"><span style={{ height: `${100 * d.xp / max}%` }} /></div><span>{new Intl.DateTimeFormat("en", { timeZone: "Africa/Lagos", weekday: "narrow" }).format(d.date)}</span></div>)}</div><p className="ps-muted">Based on your latest 50 XP awards · West Africa Time.</p></section>;
}

function ScheduledReviews({ reviews }: { reviews: XpProgress["reviews"] }) {
  const start = useStartTopicReview();
  const router = useRouter();
  return <details className="ps-details"><summary>Scheduled reviews{reviews.some(r => r.available) ? " · Review due" : ""}</summary>{reviews.length ? <ul className="ps-review-list">{reviews.map(r => <li key={`${r.lesson_id}-${r.stage}`}><div><strong>{r.title} · Review {r.stage}</strong><p className="ps-muted">{r.completed ? "Completed" : `Due ${formatDateTime(r.due_at)}`}</p></div>{r.available ? <Button size="sm" loading={start.isPending && start.variables?.lessonId === r.lesson_id && start.variables?.stage === r.stage} disabled={start.isPending} onClick={() => start.mutate({ lessonId: r.lesson_id, stage: r.stage }, { onSuccess: a => router.push(`/attempts/${a.attempt_id}`) })}>Start review</Button> : null}</li>)}</ul> : <p className="ps-muted">Score at least 80% on a topic check to schedule reviews after 1, 7 and 30 days.</p>}<InlineError error={start.error} /></details>;
}

export function ProfileBadges() {
  const xp = useXpProgress();
  if (xp.isPending) return <LoadingState label="Loading badges…" lines={2} />;
  if (xp.isError) return <ErrorState error={xp.error} onRetry={() => void xp.refetch()} />;
  const earned = new Set(xp.data.badges.map(b => b.code));
  const entries = Object.entries(XP_BADGES);
  const renderBadges = (unlocked: boolean) => <ul className="ps-badges">{entries.filter(([code]) => earned.has(code) === unlocked).map(([code, badge]) => <li key={code}><AchievementMedal code={code} earned={unlocked} /><strong>{badge.title}</strong><p>{badge.description}</p></li>)}</ul>;
  return <><div className="ps-section-heading"><h2>Your achievements</h2><span>{entries.filter(([code]) => earned.has(code)).length} earned</span></div>{earned.size ? renderBadges(true) : <p className="ps-muted">Complete a topic check to earn your first badge.</p>}{entries.some(([code]) => !earned.has(code)) ? <details className="ps-details"><summary>View locked badges</summary>{renderBadges(false)}</details> : null}<ScheduledReviews reviews={xp.data.reviews} /></>;
}
