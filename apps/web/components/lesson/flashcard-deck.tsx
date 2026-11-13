"use client";

import { MathText } from "@/components/math/math-text";
import { briefFlashcardBack } from "@scholau/core";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { lessonCardText, type ExamFlashcard } from "@/lib/lesson-exam-cards";
import { cn } from "@/lib/utils";

type FlashcardDeckProps = {
  cards: ExamFlashcard[];
  onLastCardReached?: () => void;
};

function NoteBody({ text }: { text: string }) {
  const brief = briefFlashcardBack(text);
  const lines = brief.split("\n").filter(Boolean);
  if (lines.length < 2) {
    return (
      <p className="flashcard-text flashcard-note-body">
        <MathText text={brief} />
      </p>
    );
  }
  return (
    <ul className="flashcard-points flashcard-note-body">
      {lines.map((line, index) => (
        <li key={`${index}-${line}`}>
          <MathText text={line} />
        </li>
      ))}
    </ul>
  );
}

function tagLabel(tag: ExamFlashcard["tag"]) {
  if (tag === "tip") return "Exam tip";
  if (tag === "section" || tag === "focus" || tag === "recap") return "Note";
  if (!tag) return null;
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

export function FlashcardDeck({ cards, onLastCardReached }: FlashcardDeckProps) {
  const [index, setIndex] = useState(0);
  const [visited, setVisited] = useState(() => new Set<number>([0]));
  const [slideDir, setSlideDir] = useState<"next" | "prev" | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const total = cards.length;
  const card = cards[index];
  const isLast = index >= total - 1;
  const deckDone = visited.size >= total && isLast;

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(total - 1, next));
      if (clamped === index) return;
      setSlideDir(clamped > index ? "next" : "prev");
      setIndex(clamped);
      setVisited((prev) => {
        const copy = new Set(prev);
        copy.add(clamped);
        return copy;
      });
    },
    [index, total],
  );

  useEffect(() => {
    if (total > 0 && index === total - 1) onLastCardReached?.();
  }, [index, onLastCardReached, total]);

  useEffect(() => {
    if (!slideDir) return;
    const timer = window.setTimeout(() => setSlideDir(null), 280);
    return () => window.clearTimeout(timer);
  }, [index, slideDir]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select, button, a"))) {
        return;
      }
      if (event.key === "ArrowRight" && index < total - 1) {
        event.preventDefault();
        goTo(index + 1);
      } else if (event.key === "ArrowLeft" && index > 0) {
        event.preventDefault();
        goTo(index - 1);
      }
    };
    node.addEventListener("keydown", onKeyDown);
    return () => node.removeEventListener("keydown", onKeyDown);
  }, [goTo, index, total]);

  if (!card) return null;

  const tag = tagLabel(card.tag);
  const topic = lessonCardText(card.front);
  const showTitle = topic && topic.replace(/\s+/g, " ").trim().toLowerCase() !== card.back.replace(/\s+/g, " ").trim().toLowerCase();

  return (
    <div ref={rootRef} className="flashcard-deck" tabIndex={0}>
      <div className="flashcard-deck-meta">
        <p className="flashcard-deck-count" aria-live="polite">
          {index + 1} / {total}
        </p>
        <ul className="flashcard-deck-dots" aria-hidden>
          {cards.map((c, i) => (
            <li key={c.id} className={cn("flashcard-dot", i === index && "is-current", visited.has(i) && "is-seen")} />
          ))}
        </ul>
        {deckDone ? <p className="flashcard-deck-done">All notes seen</p> : <span className="flashcard-deck-done-spacer" aria-hidden />}
      </div>

      <div className={cn("flashcard-stage", slideDir === "next" && "is-slide-next", slideDir === "prev" && "is-slide-prev")}>
        <article
          className={cn("flashcard-note", card.tag === "tip" && "flashcard-note-tip")}
          aria-label={topic ? `Study note: ${topic}` : "Study note"}
        >
          {tag ? <span className="flashcard-tag">{tag}</span> : null}
          {topic ? (
            <h3 className="flashcard-note-title">
              <MathText text={topic} />
            </h3>
          ) : null}
          <div className="flashcard-note-content">
            <NoteBody text={card.back} />
          </div>
        </article>
      </div>

      <nav className="flashcard-nav flashcard-nav-compact" aria-label="Note navigation">
        <Button type="button" variant="outline" size="sm" onClick={() => goTo(index - 1)} disabled={index === 0}>
          <ArrowLeft className="size-4" aria-hidden /> Prev
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => goTo(index + 1)} disabled={index >= total - 1}>
          Next <ArrowRight className="size-4" aria-hidden />
        </Button>
      </nav>
    </div>
  );
}
