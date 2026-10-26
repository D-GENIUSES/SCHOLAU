"use client";

import { MathText } from "@/components/math/math-text";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { lessonCardText, type ExamFlashcard } from "@/lib/lesson-exam-cards";
import { cn } from "@/lib/utils";

type FlashcardDeckProps = {
  cards: ExamFlashcard[];
  onLastCardReached?: () => void;
};

export function FlashcardDeck({ cards, onLastCardReached }: FlashcardDeckProps) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [visited, setVisited] = useState(() => new Set<number>([0]));
  const liveId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  const total = cards.length;
  const card = cards[index];

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(total - 1, next));
      setIndex(clamped);
      setFlipped(false);
      setVisited((prev) => {
        const copy = new Set(prev);
        copy.add(clamped);
        return copy;
      });
      if (clamped === total - 1) onLastCardReached?.();
    },
    [onLastCardReached, total],
  );

  const flip = useCallback(() => setFlipped((v) => !v), []);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select, button, a"))) {
        if (event.key !== " " && event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      }
      if (event.key === " ") {
        event.preventDefault();
        flip();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        if (flipped && index < total - 1) goTo(index + 1);
        else if (!flipped) setFlipped(true);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (index > 0) goTo(index - 1);
      }
    };
    node.addEventListener("keydown", onKeyDown);
    return () => node.removeEventListener("keydown", onKeyDown);
  }, [flip, flipped, goTo, index, total]);

  if (!card) return null;


  return (
    <div ref={rootRef} className="flashcard-deck" tabIndex={-1}>
      <div className="flashcard-deck-meta">
        <p className="flashcard-deck-count" aria-live="polite">
          {index + 1} / {total}
        </p>
        <ul className="flashcard-deck-dots" aria-hidden>
          {cards.map((c, i) => (
            <li key={c.id} className={cn("flashcard-dot", i === index && "is-current", visited.has(i) && "is-seen")} />
          ))}
        </ul>
      </div>

      <button
        type="button"
        className={cn("flashcard-scene", flipped && "is-flipped")}
        onClick={flip}
        aria-pressed={flipped}
        aria-label={flipped ? "Show question" : "Show answer"}
        aria-describedby={liveId}
      >
        <div className="flashcard-inner">
          <div className="flashcard-face flashcard-front" aria-hidden={flipped}>
            <p className="flashcard-text"><MathText text={lessonCardText(card.front)} /></p>
          </div>
          <div className="flashcard-face flashcard-back" aria-hidden={!flipped}>
            <p className="flashcard-text whitespace-pre-line"><MathText text={lessonCardText(card.back)} /></p>
          </div>
        </div>
      </button>

      <p id={liveId} className="sr-only">
        {flipped ? "Answer side showing" : "Question side showing"}
      </p>

      <nav className="flashcard-nav" aria-label="Card navigation">
        <Button type="button" variant="outline" size="sm" onClick={() => goTo(index - 1)} disabled={index === 0}>
          <ArrowLeft className="size-4" aria-hidden /> Previous
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={flip}>{flipped ? "Question" : "Reveal"}</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => goTo(index + 1)} disabled={index >= total - 1}>
          Next <ArrowRight className="size-4" aria-hidden />
        </Button>
      </nav>

    </div>
  );
}
