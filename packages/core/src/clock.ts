/**
 * Server-derived time. Every RPC response carries `server_time`; we keep a smoothed offset so that
 * countdowns show server-relative remaining time. The client never decides deadline validity.
 */
export class ServerClock {
  private offsetMs = 0;
  private samples = 0;

  /** Record a server timestamp observed at local time `receivedAt` (defaults to now). */
  observe(serverTime: string | null | undefined, receivedAt: number = Date.now()): void {
    if (!serverTime) return;
    const server = Date.parse(serverTime);
    if (Number.isNaN(server)) return;
    const sample = server - receivedAt;
    // Exponential smoothing; first sample is taken as-is.
    this.offsetMs = this.samples === 0 ? sample : this.offsetMs * 0.7 + sample * 0.3;
    this.samples += 1;
  }

  get offset(): number {
    return this.offsetMs;
  }

  now(): number {
    return Date.now() + this.offsetMs;
  }

  /** Milliseconds until `deadline` by server time (negative when passed). */
  remaining(deadline: string | null | undefined): number {
    if (!deadline) return 0;
    return Date.parse(deadline) - this.now();
  }
}

export const serverClock = new ServerClock();

export function remainingMs(deadline: string | null | undefined, clock: ServerClock = serverClock): number {
  return Math.max(0, clock.remaining(deadline));
}

/** Fraction of a window elapsed, 0..1, for progress bars. */
export function windowProgress(start: string | null | undefined, end: string | null | undefined, clock: ServerClock = serverClock): number {
  if (!start || !end) return 0;
  const s = Date.parse(start);
  const e = Date.parse(end);
  if (e <= s) return 1;
  return Math.min(1, Math.max(0, (clock.now() - s) / (e - s)));
}
