export const AVATAR_PRESETS = [
  { id: 0, name: "Blue", path: "presets/person-0" },
  { id: 1, name: "Sage", path: "presets/person-1" },
  { id: 2, name: "Ember", path: "presets/person-2" },
  { id: 3, name: "Violet", path: "presets/person-3" },
  { id: 4, name: "Ocean", path: "presets/person-4" },
  { id: 5, name: "Sunshine", path: "presets/person-5" },
] as const;

export function avatarPresetIndex(path?: string | null): number | null {
  const match = /^presets\/person-([0-5])$/.exec(path ?? "");
  return match ? Number(match[1]) : null;
}

export function fallbackAvatarIndex(name: string): number {
  return Array.from(name).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0) % 6;
}
