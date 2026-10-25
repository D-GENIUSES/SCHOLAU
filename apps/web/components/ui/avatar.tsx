"use client";

import Image from "next/image";
import { useState } from "react";
import { avatarPresetIndex, fallbackAvatarIndex } from "@/lib/avatar-presets";

export function Avatar({
  name,
  path,
  size = 40,
  publicProfile = false,
  variant = "default",
}: {
  name: string;
  path?: string | null;
  publicProfile?: boolean;
  size?: 32 | 40 | 56 | 72 | 96;
  variant?: "default" | "profile";
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const source = path && /^avatars\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/.test(path) && failed !== path ? `/api/profile-photo?path=${encodeURIComponent(path)}${publicProfile ? "&scope=public" : ""}` : null;
  const preset = avatarPresetIndex(path) ?? fallbackAvatarIndex(name);
  const profileRing =
    variant === "profile"
      ? "border-2 border-white shadow-[0_2px_8px_rgba(17,36,60,0.12)]"
      : "border border-line";
  return <span aria-hidden className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-tint font-semibold text-brand-primary ${profileRing}`} style={{ width: size, height: size, minWidth: size, fontSize: size === 96 ? 28 : size === 72 ? 24 : size === 40 ? 14 : 12 }}>
    {source ? <Image key={path} src={source} alt="" width={size} height={size} unoptimized className="h-full w-full object-cover" onError={() => setFailed(path ?? null)} /> : <Image src={`/avatars/person-${preset}.svg`} alt="" width={size} height={size} unoptimized className="h-full w-full object-cover" />}
  </span>;
}
