"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { newRequestKey, qk } from "@scholau/api";
import { adminUsersApi, type ManagedUser } from "@/lib/admin-users-api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function AdminAwardXp({ user, disabled = false, onBusyChange }: { user: ManagedUser; disabled?: boolean; onBusyChange: (busy: boolean) => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [balance, setBalance] = useState(user.xp_total);
  const request = useRef<{ key: string; amount: number; reason: string } | null>(null);
  const sending = useRef(false);
  const value = Number(amount);
  const valid = /^\d+$/.test(amount) && Number.isSafeInteger(value) && value > 0;

  async function award() {
    if (!valid || disabled || sending.current) return;
    sending.current = true; setPending(true); onBusyChange(true); setError(null); setNotice(null);
    const reason = note.trim();
    if (!request.current || request.current.amount !== value || request.current.reason !== reason) {
      request.current = { key: newRequestKey(), amount: value, reason };
    }
    try {
      const result = await adminUsersApi.awardXp(user.id, value, reason, request.current.key);
      setBalance(result.xp_total);
      setNotice(`${result.amount.toLocaleString("en-GB")} XP added to ${user.display_name || user.email || "this user"}. Balance: ${result.xp_total.toLocaleString("en-GB")} XP.`);
      request.current = null; setAmount(""); setNote("");
      void Promise.all([qk.profile(), qk.home(), ["scholau", "xp"], ["scholau", "leaderboard"], qk.admin.all].map(queryKey => qc.invalidateQueries({ queryKey })));
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setError(code === "FORBIDDEN" ? "Only an active administrator can add XP." : code === "NOT_FOUND" ? "This user no longer has an application profile." : code === "VALIDATION_FAILED" ? "Enter a positive whole number within the supported XP balance range." : "The award could not be confirmed. Retry with the same amount and note to avoid adding it twice.");
    } finally { sending.current = false; setPending(false); onBusyChange(false); }
  }

  return <form className="flex flex-col gap-3 rounded-control border border-line bg-surface-tint p-4" onSubmit={e => { e.preventDefault(); void award(); }}>
    <div><h3 className="font-bold">Add XP points</h3><p className="text-sm text-ink-muted">Add points to {user.display_name || user.email || "this user"}. Manual awards do not use daily earning limits.</p></div>
    {balance != null ? <p className="text-sm font-semibold">Current balance: {balance.toLocaleString("en-GB")} XP</p> : null}
    <fieldset disabled={disabled || pending || !user.has_profile} className="flex min-w-0 flex-col gap-3"><legend className="sr-only">Manual XP award</legend>
      <Field id="manual-xp-amount" label="XP to add" hint="Enter a positive whole number."><Input id="manual-xp-amount" type="text" inputMode="numeric" pattern="[0-9]+" required value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 500" /></Field>
      <Field id="manual-xp-note" label="Note (optional)"><Input id="manual-xp-note" value={note} maxLength={500} onChange={e => setNote(e.target.value)} placeholder="Reason for this award" /></Field>
      <Button type="submit" disabled={!valid} loading={pending}>Add {valid ? `${value.toLocaleString("en-GB")} ` : ""}XP</Button>
    </fieldset>
    {error ? <Alert tone="error" role="alert">{error}</Alert> : null}
    {notice ? <Alert tone="success" role="status">{notice}</Alert> : null}
  </form>;
}
