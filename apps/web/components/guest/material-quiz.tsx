"use client";

import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/input";
import { Progress } from "@/components/ui/misc";
import questions from "./material-questions.json";

export type GuestMaterialQuestion = typeof questions[number];
export const guestQuizCourses = [...new Map(questions.map(q => [q.courseCode, {
  code: q.courseCode, title: q.courseTitle, level: q.level,
}])).values()].sort((a, b) => a.level - b.level || a.code.localeCompare(b.code));

/** Public learning questions only. The private battle pool is never imported here. */
export function chooseGuestQuestions(course: string, random = Math.random): GuestMaterialQuestion[] {
  const pool = questions.filter(q => course === "mixed" || q.courseCode === course);
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  if (course !== "mixed") return shuffled.slice(0, 5);
  // Mixed quizzes cover different subjects rather than taking five items from one course.
  const seen = new Set<string>();
  return shuffled.filter(q => {
    if (seen.has(q.courseCode)) return false;
    seen.add(q.courseCode);
    return true;
  }).slice(0, 5);
}

export function MaterialQuiz() {
  const [course, setCourse] = useState("mixed");
  const [quiz, setQuiz] = useState<GuestMaterialQuestion[] | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const q = quiz?.[index];
  function start() {
    setQuiz(chooseGuestQuestions(course));
    setIndex(0); setSelected(null); setChecked(false); setScore(0); setFinished(false);
  }
  function check() {
    if (!q || selected === null || checked) return;
    if (selected === q.correct) setScore(n => n + 1);
    setChecked(true);
  }
  function next() {
    if (!quiz || !checked) return;
    if (index === quiz.length - 1) setFinished(true);
    else { setIndex(n => n + 1); setSelected(null); setChecked(false); }
  }
  return <div className="guest-reading">
    <Link href="/home" className="back-link"><ArrowLeft className="size-4" aria-hidden />Back to Home</Link>
    <p className="content-label">Course practice · Guest mode</p>
    <h1>{finished ? "Quiz results" : "Course quiz"}</h1>
    <p className="reading-lead">Practice with questions based on the Computer Science course materials. No account needed.</p>
    {!quiz ? <div className="practice-card">
      <h2>Choose your quiz</h2>
      <p className="text-ink-muted">{questions.length} questions across {guestQuizCourses.length} courses, from 100 to 400 level. Each quiz has five questions with explanations.</p>
      <Field id="guest-quiz-course" label="Course"><NativeSelect value={course} onChange={e => setCourse(e.target.value)}>
        <option value="mixed">Mixed course quiz</option>
        {[100, 200, 300, 400].map(level => <optgroup key={level} label={`${level} level`}>{guestQuizCourses.filter(c => c.level === level).map(c => <option key={c.code} value={c.code}>{c.code} — {c.title}</option>)}</optgroup>)}
      </NativeSelect></Field>
      <Button onClick={start} className="self-start">Start quiz</Button>
    </div> : finished ? <div className="practice-result" role="status">
      <h2>{score} of {quiz.length} correct</h2>
      <p>{score === quiz.length ? "You answered every question correctly." : "Try again to practise the concepts and review their explanations."}</p>
      <div className="flex flex-wrap gap-3"><Button onClick={start} variant="outline">Try again</Button><Button variant="outline" onClick={() => { setQuiz(null); setFinished(false); }}>Choose another course</Button><Button asChild><Link href="/sign-up">Create account</Link></Button></div>
    </div> : q ? <div className="practice-card">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-muted"><span>Question {index + 1} of {quiz.length}</span><span>{q.courseCode} · Untimed</span></div>
      <Progress value={100 * (index + (checked ? 1 : 0)) / quiz.length} label="Quiz progress" />
      <fieldset disabled={checked}>
        <legend className="practice-question">{q.prompt}</legend>
        <div className="practice-options">{q.options.map((option, i) => <label key={option} className={`practice-option${selected === i ? " selected" : ""}${checked && i === q.correct ? " correct" : checked && selected === i ? " incorrect" : ""}`}>
          <input type="radio" name={`material-question-${q.id}`} checked={selected === i} onChange={() => setSelected(i)} />
          <span className="min-w-0 break-words">{option}</span>{checked && i === q.correct ? <CheckCircle2 className="size-5 shrink-0" aria-hidden /> : null}
        </label>)}</div>
      </fieldset>
      {checked ? <div className={`practice-feedback ${selected === q.correct ? "correct" : "incorrect"}`} role="status">
        {selected === q.correct ? <CheckCircle2 className="size-5 shrink-0" aria-hidden /> : <XCircle className="size-5 shrink-0" aria-hidden />}
        <div className="min-w-0"><strong>{selected === q.correct ? "Correct" : "Incorrect"}</strong><p>{q.explanation}</p><p className="mt-2 break-words text-xs">Source: {q.sourceReference}</p></div>
      </div> : null}
      <Button onClick={checked ? next : check} disabled={!checked && selected === null} className="self-start">{checked ? index === quiz.length - 1 ? "See results" : "Next question" : "Check answer"}</Button>
    </div> : null}
    <p className="text-sm text-ink-muted">Guest quiz results are not saved and do not award account XP. Sign in to save progress and join battles.</p>
  </div>;
}
