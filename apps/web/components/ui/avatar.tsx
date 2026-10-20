"use client";

import Image from "next/image";
import { useState } from "react";
import { initials } from "@scholau/core";

export function Avatar({ name, path, size = 40, publicProfile = false }: { name: string; path?: string | null; publicProfile?: boolean; size?: 32 | 40 | 56 | 72 | 96 }) {
  const [failed, setFailed] = useState<string | null>(null);
  const source = path && /^avatars\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/.test(path) && failed !== path ? `/api/profile-photo?path=${encodeURIComponent(path)}${publicProfile ? "&scope=public" : ""}` : null;
  return <span aria-hidden className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-tint font-semibold text-brand-primary" style={{ width: size, height: size, minWidth: size, fontSize: size === 96 ? 28 : size === 72 ? 24 : size === 40 ? 14 : 12 }}>
    {source ? <Image key={path} src={source} alt="" width={size} height={size} unoptimized className="h-full w-full object-cover" onError={() => setFailed(path ?? null)} /> : initials(name)}
  </span>;
}
