/** Canonical product copy from the UI/UX specification. Keep wording exact where quoted there. */
export const COPY = {
  tagline: "Study. Compete. Rise.",
  battle: {
    unlimited: "Unlimited battles | Earn XP for every completed match.",
    rewards: "Win +25 XP · Draw +10 XP · Loss +5 XP",
    rewardsNote: "Both players earn XP for every completed match. Battle XP has no daily limit.",
    format: "5 questions · 20 seconds each · accuracy only — equal scores draw.",
    noOpponent: "No opponent found yet.",
    reconnecting: "Reconnecting. The round timer continues.",
    finalizing: "Your battle has ended. Results are being finalized.",
    leaveWarning:
      "If you leave before the battle starts, it is cancelled with no XP for either player. If you forfeit after it starts, the match is cancelled and nobody earns XP. Closing the tab or losing connection does not forfeit — the match continues and is graded at the scheduled end.",
    timerRule: "Answers received after this timer ends will not count.",
  },
  learning: {
    capReached: "You have reached today's learning XP limit. You can keep studying and earn XP in battles.",
    capReset: "The learning XP limit resets at midnight (Africa/Lagos time). Battle XP is never capped.",
    timerRule: "Answers received after this timer ends will not count.",
    expired: "Time ended. We're grading your saved answers.",
    unsaved: "Answer not saved yet.",
    saved: "Saved",
    selected: "Selected",
    leaveAttempt:
      "Your saved answers are kept and you can resume this attempt later. Answers that show “Answer not saved yet” may be lost. For timed attempts the timer keeps running while you are away.",
  },
  empty: {
    noCourse: "Your course isn't available in this pilot yet.",
    offline: "You're offline. Previously loaded content may remain visible.",
    contentRemoved: "This content is under review.",
    serviceUnavailable: "The service is unavailable right now. Please retry.",
  },
  academicChange:
    "You can change your academic profile once per academic period. Your lifetime XP stays the same and your history is kept, but your faculty ranking moves to your new faculty. Courses outside your new department, level or semester will be unenrolled. After this change, further corrections need an administrator.",
} as const;
