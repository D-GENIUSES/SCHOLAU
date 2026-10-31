"use client";

import type { FriendPerson } from "@scholau/api";
import { OnlineAvatar } from "@/components/ui/online-avatar";
import { cn } from "@/lib/utils";

export function opponentBattleBusyLabel(busy: FriendPerson["battle_busy"]): string | null {
  if (busy === "battle") return "In a battle";
  if (busy === "queue") return "Finding an opponent";
  return null;
}

export function OpponentPickerOption({
  person,
  selected,
  disabled,
  onChoose,
}: {
  person: FriendPerson;
  selected: boolean;
  disabled?: boolean;
  onChoose: () => void;
}) {
  const busyLabel = opponentBattleBusyLabel(person.battle_busy);
  const unavailable = Boolean(person.battle_busy);
  return (
    <button
      type="button"
      disabled={disabled || unavailable}
      aria-pressed={selected}
      aria-disabled={unavailable || undefined}
      className={cn("battle-opponent-option", unavailable && "battle-opponent-option-unavailable")}
      onClick={() => {
        if (!unavailable) onChoose();
      }}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <OnlineAvatar name={person.display_name} path={person.avatar_path} size={32} online={person.online} />
        <span className="min-w-0 text-left">
          <strong className="block truncate">{person.display_name}</strong>
          <small className="block truncate text-ink-muted">@{person.username}</small>
          <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            <span className={person.online ? "text-success" : "text-ink-muted"}>
              {person.online ? "Online" : "Offline"}
            </span>
            {busyLabel ? <span className="text-warning">{busyLabel}</span> : null}
          </span>
        </span>
      </span>
      <span className="shrink-0 text-xs font-semibold">
        {unavailable ? "Unavailable" : selected ? "Selected" : "Choose"}
      </span>
    </button>
  );
}
