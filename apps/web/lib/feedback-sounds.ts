const STORAGE_KEY = "scholau.notification-sound";

let audio: AudioContext | null = null;
let unlockInstalled = false;

function enabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem(STORAGE_KEY) === "off") return false;
  } catch {
    return true;
  }
  return true;
}

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audio) audio = new Ctor();
  return audio;
}

export function installFeedbackSoundUnlock(): void {
  if (typeof window === "undefined" || unlockInstalled) return;
  unlockInstalled = true;
  const unlock = () => {
    const context = ctx();
    if (context?.state === "suspended") void context.resume().catch(() => undefined);
  };
  window.addEventListener("pointerdown", unlock, { capture: true, passive: true });
  window.addEventListener("keydown", unlock, { capture: true });
}

function tone(context: AudioContext, frequency: number, start: number, duration: number, volume: number): void {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = "triangle";
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(context.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

function playSequence(notes: { freq: number; at: number; dur: number; vol: number }[]): void {
  if (!enabled()) return;
  const context = ctx();
  if (!context) return;
  const run = () => {
    try {
      notes.forEach((n) => tone(context, n.freq, context.currentTime + n.at, n.dur, n.vol));
    } catch {
      // A closed audio device should not interrupt the screen.
    }
  };
  if (context.state === "suspended") void context.resume().then(run).catch(() => undefined);
  else run();
}

export function playLessonCompleteSound(): void {
  playSequence([
    { freq: 523.25, at: 0, dur: 0.16, vol: 0.22 },
    { freq: 659.25, at: 0.14, dur: 0.18, vol: 0.24 },
    { freq: 783.99, at: 0.3, dur: 0.28, vol: 0.22 },
  ]);
}

export function playStreakExtendedSound(): void {
  playSequence([
    { freq: 659.25, at: 0, dur: 0.12, vol: 0.2 },
    { freq: 783.99, at: 0.12, dur: 0.12, vol: 0.22 },
    { freq: 1046.5, at: 0.24, dur: 0.28, vol: 0.24 },
  ]);
}

export function playBattleWinSound(): void {
  playSequence([
    { freq: 523.25, at: 0, dur: 0.12, vol: 0.22 },
    { freq: 659.25, at: 0.12, dur: 0.12, vol: 0.24 },
    { freq: 783.99, at: 0.24, dur: 0.14, vol: 0.26 },
    { freq: 1046.5, at: 0.4, dur: 0.32, vol: 0.24 },
  ]);
}

export function playBattleLossSound(): void {
  playSequence([
    { freq: 392, at: 0, dur: 0.24, vol: 0.2 },
    { freq: 311.13, at: 0.18, dur: 0.36, vol: 0.22 },
    { freq: 233.08, at: 0.4, dur: 0.4, vol: 0.18 },
  ]);
}

export function playTauntSound(reaction: "laugh" | "angry" | "handshake"): void {
  if (reaction === "laugh") {
    playSequence([
      { freq: 784, at: 0, dur: 0.08, vol: 0.18 },
      { freq: 988, at: 0.08, dur: 0.08, vol: 0.18 },
      { freq: 1174, at: 0.16, dur: 0.12, vol: 0.16 },
    ]);
    return;
  }
  if (reaction === "angry") {
    playSequence([
      { freq: 196, at: 0, dur: 0.12, vol: 0.22 },
      { freq: 146, at: 0.1, dur: 0.18, vol: 0.2 },
    ]);
    return;
  }
  playSequence([
    { freq: 523.25, at: 0, dur: 0.12, vol: 0.16 },
    { freq: 659.25, at: 0.12, dur: 0.16, vol: 0.16 },
  ]);
}

export function feedbackSoundEnabled(): boolean {
  return enabled();
}

export function setFeedbackSoundEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
    window.dispatchEvent(new Event("scholau-sound"));
  } catch {
    // ignore
  }
}
