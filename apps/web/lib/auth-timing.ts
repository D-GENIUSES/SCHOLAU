const departureKey = "scholau.auth.google.departed";

/** Local performance entries only: no account data, URLs or tokens. */
export function measureAuth(stage: "google.start" | "google.return", start: number) {
  try { performance.measure(`scholau.auth.${stage}`, { start, end: performance.now() }); } catch { /* Timing must never block sign-in. */ }
}

export function markGoogleDeparture() {
  try { sessionStorage.setItem(departureKey, String(Date.now())); } catch { /* Storage may be disabled. */ }
}

export function measureGoogleReturn() {
  try {
    const value = sessionStorage.getItem(departureKey);
    if (!value) return;
    sessionStorage.removeItem(departureKey);
    const elapsed = Date.now() - Number(value);
    // Includes time choosing an account/consenting at Google, not just network time.
    if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 60 * 60 * 1000) {
      performance.measure("scholau.auth.google.return", { start: 0, duration: elapsed });
    }
  } catch { /* Storage may be disabled. */ }
}
