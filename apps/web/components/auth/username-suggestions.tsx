"use client";

import { getBrowserSupabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";

export async function suggestUsernames(username: string): Promise<string[]> {
  try {
    const { data, error } = await getBrowserSupabase().rpc("suggest_usernames_v1", { p_username: username });
    return !error && Array.isArray(data) ? data.filter((value): value is string => typeof value === "string") : [];
  } catch { return []; }
}

export function UsernameSuggestions({ names, onChoose }: { names: string[]; onChoose: (name: string) => void }) {
  if (!names.length) return null;
  return <div aria-live="polite" className="flex flex-wrap items-center gap-2 text-sm">
    <p className="w-full text-ink-muted">Try one of these available usernames:</p>
    {names.map((name) => <Button key={name} type="button" variant="outline" onClick={() => onChoose(name)}>@{name}</Button>)}
  </div>;
}
