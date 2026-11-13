"use client";

import { MathText } from "@/components/math/math-text";
import { briefFlashcardBack } from "@scholau/core";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { lessonCardText, type ExamFlashcard } from "@/lib/lesson-exam-cards";
import { cn } from "@/lib/utils";

type FlashcardDeckProps = {
  cards: ExamFlashcard[];
  onLastCardReached?: () => void;
};

function FlashcardBack({ text }: { text: string }) {
  const brief = briefFlashcardBack(text);
  const lines = brief.split("\n").filter(Boolean);
  if (lines.length < 2) {
    return (
      <p className="flashcard-text flashcard-answer">
        <MathText text={brief} />
      </p>
    );
  }
  return (
    <ul className="flashcard-points flashcard-answer">
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
  const [flipped, setFlipped] = useState(false);
  const [visited, setVisited] = useState(() => new Set<number>([0]));
  const [slideDir, setSlideDir] = useState<"next" | "prev" | null>(null);
  const liveId = useId();
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
      setFlipped(false);
      setVisited((prev) => {
        const copy = new Set(prev);
        copy.add(clamped);
        return copy;
      });
    },
    [index, total],
  );

  const flip = useCallback(() => setFlipped((v) => !v), []);

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

  const tag = tagLabel(card.tag);

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
        {deckDone ? <p className="flashcard-deck-done">Deck complete</p> : <span className="flashcard-deck-done-spacer" aria-hidden />}
      </div>

      <div className={cn("flashcard-stage", slideDir === "next" && "is-slide-next", slideDir === "prev" && "is-slide-prev")}>
        <button
          type="button"
          className={cn("flashcard-scene", flipped && "is-flipped")}
          onClick={flip}
          aria-pressed={flipped}
          aria-label={flipped ? "Show topic" : "Show notes"}
          aria-describedby={liveId}
        >
          <div className="flashcard-inner">
            <div className="flashcard-face flashcard-front" aria-hidden={flipped}>
              {tag ? <span className="flashcard-tag">{tag}</span> : null}
              <div className="flashcard-content">
                <p className="flashcard-text flashcard-front-label">
                  <MathText text={lessonCardText(card.front)} />
                </p>
              </div>
              <p className="flashcard-hint">Tap for notes · Space</p>
            </div>
            <div className="flashcard-face flashcard-back" aria-hidden={!flipped}>
              {tag ? <span className="flashcard-tag">{tag}</span> : null}
              <div className="flashcard-content">
                <FlashcardBack text={card.back} />
              </div>
            </div>
          </div>
        </button>
      </div>

      <p id={liveId} className="sr-only">
        {flipped ? "Notes showing" : "Topic showing"}
      </p>

      <nav className="flashcard-nav" aria-label="Card navigation">
        <Button type="button" variant="outline" size="sm" onClick={() => goTo(index - 1)} disabled={index === 0}>
          <ArrowLeft className="size-4" aria-hidden /> Previous
        </Button>
        <Button type="button" variant={flipped ? "ghost" : "primary"} size="sm" onClick={flip}>
          {flipped ? "Topic" : "Notes"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => goTo(index + 1)} disabled={index >= total - 1}>
          Next <ArrowRight className="size-4" aria-hidden />
        </Button>
      </nav>
    </div>
  );
}
