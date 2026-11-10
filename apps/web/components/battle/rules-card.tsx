"use client";

import { useEffect, useRef } from "react";
import { COPY } from "@scholau/core";
import "./battle-rules.css";
import { Card } from "@/components/ui/card";

export function BattleRulesCard({ title = "How battles work", headingLevel = "h2" }: { title?: string; headingLevel?: "h2" | "h3" }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const TitleTag = headingLevel;

  useEffect(() => {
    const details = detailsRef.current;
    if (!details) return;
    const mq = window.matchMedia("(min-width: 900px)");
    const sync = () => {
      details.open = mq.matches;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <Card className="battle-rules-card shadow-none">
      <details ref={detailsRef} className="battle-rules-disclosure">
        <summary className="battle-rules-summary">
          <TitleTag className="battle-rules-title">{title}</TitleTag>
          <span className="battle-rules-chevron" aria-hidden />
        </summary>
        <div className="battle-rules-body">
          <p className="battle-rules-lead">Both players get the same questions and the same time.</p>
          <div className="battle-rewards-panel">
            <div>
              <span className="battle-rewards-label">XP</span>
              <p className="battle-rewards-copy">{COPY.battle.rewards}</p>
            </div>
          </div>
          <details className="battle-rules-details">
            <summary>Format and fair play</summary>
            <div className="pt-3">
              <BattleRulesList />
            </div>
          </details>
        </div>
      </details>
    </Card>
  );
}

const rules = [
  { title: "Same questions", text: "Both players get the same 5–30 questions. Highest accuracy wins. Equal scores draw." },
  { title: "Timed answers", text: "Each question starts with reading time, then 5–15 seconds to answer." },
  { title: "Stay focused", text: "Keep the app in view and use a full window. Leaving, losing focus, or using a small window can trigger a flag." },
  { title: "Do not share answers", text: "Do not share your screen. Copying battle text is disabled, and your opponent cannot see your choices." },
  { title: "Three flags end the match", text: "Three fair-play flags forfeit the match. Stay focused until the result appears.", warning: true },
  { title: "XP limits", text: COPY.battle.rewardsNote },
];

export function BattleRulesList() {
  return (
    <ul className="battle-rule-list">
      {rules.map(({ title, text, warning }) => (
        <li key={title} className={warning ? "battle-rule-item battle-rule-warning" : "battle-rule-item"}>
          <div>
            <p className="battle-rule-title">{title}</p>
            <p className="battle-rule-copy">{text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
