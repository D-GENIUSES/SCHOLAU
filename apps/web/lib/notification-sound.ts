const STORAGE_KEY = "scholau.notification.sound.v1";

let audio: AudioContext | null = null;
let lastChimeAt = 0;

export function notificationSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setNotificationSoundEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Private mode can reject storage. The in-memory switch still works for this view.
  }
}

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audio) audio = new Ctor();
  return audio;
}

let unlockInstalled = false;

/** Browsers block audio until a gesture. Resume on the first pointer or key. */
export function installNotificationSoundUnlock(): void {
  if (typeof window === "undefined" || unlockInstalled) return;
  unlockInstalled = true;
  const unlock = () => {
    const ctx = audioContext();
    if (!ctx || ctx.state !== "suspended") return;
    void ctx.resume().catch(() => undefined);
  };
  window.addEventListener("pointerdown", unlock, { capture: true, passive: true });
  window.addEventListener("keydown", unlock, { capture: true });
}

function chime(ctx: AudioContext): void {
  const now = ctx.currentTime;
  const notes = [659.25, 880];
  for (const [index, frequency] of notes.entries()) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = now + index * 0.12;
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.045, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(start);
    osc.stop(start + 0.18);
  }
}

/** One quiet two-tone chime. A burst of arrivals shares a single play. */
export function playNotificationChime(): void {
  if (!notificationSoundEnabled()) return;
  const nowMs = Date.now();
  if (nowMs - lastChimeAt < 800) return;
  let ctx: AudioContext;
  try {
    const created = audioContext();
    if (!created) return;
    ctx = created;
  } catch {
    return;
  }
  lastChimeAt = nowMs;
  const start = () => {
    try {
      chime(ctx);
    } catch {
      // Autoplay or a background tab can reject playback. Stay silent.
    }
  };
  if (ctx.state === "suspended") {
    void ctx.resume().then(start).catch(() => undefined);
    return;
  }
  start();
}
