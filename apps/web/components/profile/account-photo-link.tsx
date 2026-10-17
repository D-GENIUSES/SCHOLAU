"use client";

import Link from "next/link";
import { useProfile } from "@scholau/api/react";
import { Avatar } from "@/components/ui/avatar";

export function AccountPhotoLink({ showLabel = false }: { showLabel?: boolean }) {
  const { data } = useProfile();
  return <Link href="/account/photo" aria-label="Change profile photo" title="Change profile photo" className="inline-flex min-h-11 shrink-0 items-center gap-3 rounded-control text-sm font-semibold"><Avatar name={data?.display_name ?? "Your account"} path={data?.avatar_path} size={40} />{showLabel ? "Profile photo" : null}</Link>;
}
