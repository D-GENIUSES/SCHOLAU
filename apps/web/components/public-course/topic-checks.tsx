"use client";

import { useState } from "react";
import Link from "next/link";
import type { PublicQuestion } from "@/lib/public-courses/catalog";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";

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
  topicKey,
  pre,
  post,
}: {
  courseCode: string;
  topicKey: string;
  pre: PublicQuestion[];
  post: PublicQuestion[];
}) {
  const [phase, setPhase] = useState<"pre" | "post" | "report">("pre");
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
    setPhase(kind === "pre" ? "post" : "report");
  }

  if (!pre.length || !post.length) return null;
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
        <fieldset key={question.logical_question_key} className="mt-4">
          <legend>{index + 1}. {question.prompt}</legend>
          {question.options ? question.options.map((option) => (
            <label key={option.label} className="mt-2 flex min-h-11 items-start gap-2">
              <input
                type="radio"
                name={question.logical_question_key}
                value={option.label}
                checked={answers[question.logical_question_key] === option.label}
                onChange={() => setAnswers((current) => ({ ...current, [question.logical_question_key]: option.label }))}
              />
              <span>{option.label}. {option.body}</span>
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
      ))}
      <Button className="mt-4" disabled={!ready} onClick={() => void finish(phase, ask(questions, answers))}>
        {phase === "pre" ? "Save pre-test and read the lessons" : "Save post-test"}
      </Button>
    </section>
  );
}
