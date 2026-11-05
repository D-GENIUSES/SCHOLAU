"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { playBattleLossSound, playBattleWinSound } from "@/lib/feedback-sounds";
import "./result-celebration.css";

export function BattleResultCelebration({ result }: { result: "win" | "loss" }) {
  const [visible, setVisible] = useState(true);
  const sounded = useRef(false);
  useEffect(() => {
    if (!sounded.current) {
      sounded.current = true;
      if (result === "win") playBattleWinSound();
      else playBattleLossSound();
    }
    const timer = window.setTimeout(() => setVisible(false), 4600);
    return () => window.clearTimeout(timer);
  }, [result]);
  if (!visible || typeof document === "undefined") return null;
  return createPortal(<div className="battle-result-burst" data-result={result} aria-hidden="true">
    {Array.from({ length: result === "win" ? 64 : 28 }, (_, i) => <span key={i} style={{
      "--x": `${(i * 37 + 11) % 100}vw`,
      "--drift": `${((i * 23) % 31) - 15}vw`,
      "--delay": `${(i % 10) * 65}ms`,
      "--turn": `${i % 2 ? 270 : -270}deg`,
      "--size": `${20 + (i * 7) % 24}px`,
      "--peak": `${8 + (i * 13) % 48}vh`,
      "--duration": `${2600 + (i % 7) * 180}ms`,
    } as CSSProperties}>{result === "win" ? ["🎉", "🎊", "✨"][i % 3] : "😭"}</span>)}
  </div>, document.body);
}
