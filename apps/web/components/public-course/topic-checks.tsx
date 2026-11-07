"use client";

import { useState } from "react";
import { MathText } from "@/components/math/math-text";
import Link from "next/link";
import type { PublicQuestion } from "@/lib/public-courses/catalog";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { QuestionActions } from "@/components/question-actions";
import { Button } from "@/components/ui/button";
import type { StudyLink } from "@/lib/shared-study";

function ask(questions: PublicQuestion[], answers: Record<string, string>) {
  return questions.map((question) => {
    const selected = answers[question.logical_question_key];
    const correct = question.answer_format === "standard"
      ? selected === question.correct_option
      : question.gaps?.some((gap) => gap.accepted_answers.some((answer) => answer.trim().toLowerCase() === (selected ?? "").trim().toLowerCase())) ?? false;
    return { logical_question_key: question.logical_question_key, selected: selected ?? "", correct };
  });
}

export function TopicChecks({
  courseCode,
  courseSlug,
  topicKey,
  pre,
  post,
  lessonLinks = [],
  catalogShares = {},
}: {
  courseCode: string;
  courseSlug: string;
  topicKey: string;
  pre: PublicQuestion[];
  post: PublicQuestion[];
  lessonLinks?: { href: string; title: string }[];
  catalogShares?: Record<string, { link?: StudyLink; shareable: boolean }>;
}) {
  const [phase, setPhase] = useState<"pre" | "read" | "post" | "report">("pre");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const questions = phase === "post" ? post : pre;
  const preResult = ask(pre, answers);
  const postResult = ask(post, answers);
  const score = (rows: { correct: boolean }[]) => rows.filter((row) => row.correct).length;

  async function finish(kind: "pre" | "post", rows: { logical_question_key: string; selected: string; correct: boolean }[]) {
    const supabase = getBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const { error } = await supabase.rpc("submit_topic_check_v1", {
        p_course_code: courseCode,
        p_topic_key: topicKey,
        p_kind: kind,
        p_answers: rows.map(({ logical_question_key, selected }) => ({ logical_question_key, selected })),
      });
      setSaved(error ? "This result stays on this page until the practice questions are published for your account." : "Saved to your topic gap report.");
    } else {
      setSaved("Sign in to keep this result on your topic gap report.");
    }
    setPhase(kind === "pre" ? "read" : "report");
  }

  if (!pre.length || !post.length) return null;
  if (phase === "read") {
    return (
      <section className="practice-card" aria-labelledby="topic-read-title">
        <h2 id="topic-read-title">Read the lesson before your post-test</h2>
        <p className="mt-2">Your starting check is complete. Open the relevant lessons, study the worked examples, then return here to check your improvement.</p>
        {saved ? <p role="status" className="mt-2 text-sm text-ink-muted">{saved}</p> : null}
        <ul className="mt-3 list-disc pl-5">
          {lessonLinks.map((lesson) => <li key={lesson.href}><Link href={lesson.href} target="_blank" rel="noopener noreferrer">{lesson.title} (opens a new tab)</Link></li>)}
        </ul>
        <Button className="mt-4" onClick={() => setPhase("post")}>I have studied the lessons. Start post-test</Button>
      </section>
    );
  }
  if (phase === "report") {
    const preScore = score(preResult);
    const postScore = score(postResult);
    return (
      <section className="practice-card" aria-labelledby="gap-report-title">
        <h2 id="gap-report-title">Your topic gap</h2>
        <p>Pre-test {preScore} of {pre.length}. Post-test {postScore} of {post.length}. Change {postScore - preScore}.</p>
        <p>{saved}</p>
        <p><Link href="/study/gaps">Open your saved gap report</Link></p>
      </section>
    );
  }
  const ready = questions.every((question) => answers[question.logical_question_key]);
  return (
    <section className="practice-card" aria-labelledby="topic-check-title">
      <h2 id="topic-check-title">{phase === "pre" ? "Pre-test" : "Post-test"}</h2>
      <p>{phase === "pre" ? "Answer before you read the lessons." : "Answer again after the lessons. This is practice, not a past paper."}</p>
      {questions.map((question, index) => (
        <div key={question.logical_question_key} className="mt-4">
          <div className="flex justify-end">
            <QuestionActions
              shareable={catalogShares[question.logical_question_key]?.shareable === true}
              source={{ kind: "catalog", course: courseSlug, topic: topicKey, key: question.logical_question_key }}
              link={catalogShares[question.logical_question_key]?.link}
              report={{ targetType: "technical", reference: `${courseCode} / ${topicKey} / ${question.logical_question_key}` }}
            />
          </div>
          <fieldset>
            <legend>{index + 1}. <MathText text={question.prompt} /></legend>
            {question.options ? question.options.map((option) => (
              <label key={option.label} className="mt-2 flex min-h-11 items-start gap-2">
                <input
                  type="radio"
                  name={question.logical_question_key}
                  value={option.label}
                  checked={answers[question.logical_question_key] === option.label}
                  onChange={() => setAnswers((current) => ({ ...current, [question.logical_question_key]: option.label }))}
                />
                <span>{option.label}. <MathText text={option.body} /></span>
              </label>
            )) : (
              <input
                className="mt-2 min-h-11 w-full rounded-control border border-line px-3"
                aria-label="Your answer"
                value={answers[question.logical_question_key] ?? ""}
                onChange={(event) => setAnswers((current) => ({ ...current, [question.logical_question_key]: event.target.value }))}
              />
            )}
          </fieldset>
        </div>
      ))}
      <Button className="mt-4" disabled={!ready} onClick={() => void finish(phase, ask(questions, answers))}>
        {phase === "pre" ? "Save pre-test and read the lessons" : "Save post-test"}
      </Button>
    </section>
  );
}
