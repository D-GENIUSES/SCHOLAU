"use client";

import { useId } from "react";

const palettes = {
  1: {
    label: "Gold medal",
    ribbon: "#7a5410",
    metal: ["#f5e8bf", "#d5b46b", "#f6e6af", "#b48c43", "#e5ca89"],
    stroke: "#ae8947",
    face: ["#f1dfac", "#d4b470"],
    star: "#99733a",
  },
  2: {
    label: "Silver medal",
    ribbon: "#4e5d6b",
    metal: ["#f0f3f6", "#b8c2cb", "#e6ebef", "#8fa0ad", "#d4dbe1"],
    stroke: "#9aa8b5",
    face: ["#e8edf1", "#c5ced6"],
    star: "#7a8794",
  },
  3: {
    label: "Bronze medal",
    ribbon: "#7a4e32",
    metal: ["#f3dcc8", "#c9926a", "#efd5c0", "#a56b42", "#ddb08a"],
    stroke: "#a56b42",
    face: ["#f0dcc8", "#c9926a"],
    star: "#8f5635",
  },
} as const;

export function PodiumMedal({ place }: { place: 1 | 2 | 3 }) {
  const id = useId();
  const p = palettes[place];

  return (
    <svg viewBox="0 0 32 36" className="leaderboard-podium-medal" aria-hidden>
      <defs>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={p.metal[0]} />
          <stop offset=".28" stopColor={p.metal[1]} />
          <stop offset=".5" stopColor={p.metal[2]} />
          <stop offset=".78" stopColor={p.metal[3]} />
          <stop offset="1" stopColor={p.metal[4]} />
        </linearGradient>
        <linearGradient id={`${id}-face`} x2="0" y2="1">
          <stop stopColor={p.face[0]} />
          <stop offset="1" stopColor={p.face[1]} />
        </linearGradient>
      </defs>
      <path d="M9 19 6.5 33 12.5 29.5 16 34 19.5 29.5 25.5 33 23 19Z" fill={p.ribbon} />
      <path d="M10 21 8 30 12.5 27 16 31 19.5 27 24 30 22 21Z" fill="none" stroke="#fff" strokeOpacity=".18" strokeWidth="1" />
      <circle cx="16" cy="13" r="11.5" fill={`url(#${id}-metal)`} stroke={p.stroke} />
      <circle cx="16" cy="13" r="9.5" fill={`url(#${id}-face)`} stroke={p.stroke} strokeWidth=".6" />
      <path
        d="m16 19.5 1 2 2.2.3-1.6 1.5.4 2.1-2-1-2 1 .4-2.1-1.6-1.5 2.2-.3Z"
        fill={p.star}
      />
    </svg>
  );
}

export function podiumMedalLabel(place: number): string | undefined {
  if (place === 1 || place === 2 || place === 3) return palettes[place].label;
  return undefined;
}
