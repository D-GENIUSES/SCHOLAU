"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import type { FriendPerson, HomeSummary } from "@scholau/api";
import { useBattleSetup, useCreateDirectBattle, useFriends, useJoinQueue, useSearchFriends } from "@scholau/api/react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/input";
import { InlineError, LoadingState } from "@/components/ui/states";
import { BattleActionError } from "./action-error";
import "./battle-lobby.css";

type EnrolledCourse = HomeSummary["enrolled_courses"][number];
export function BattleStartPanel({ initialOfferingId }: { courses: EnrolledCourse[]; initialOfferingId: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<"random" | "direct">("random");
  const [opponent, setOpponent] = useState<FriendPerson | null>(null);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const normalizedInput = input.trim().replace(/^@/, "");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(normalizedInput), 250);
    return () => clearTimeout(timer);
  }, [normalizedInput]);
  const [chosen, setChosen] = useState<string[] | null>(null);
  const [questionCount, setQuestionCount] = useState(10);
  const friends = useFriends();
  const search = useSearchFriends(query);
  const setup = useBattleSetup();
  const shared = useBattleSetup(mode === "direct" ? opponent?.user_id : null);
  const direct = useCreateDirectBattle();
  const queue = useJoinQueue();
  const courses = setup.data?.courses ?? [];
  const fallback = courses.find(c => c.offering_id === initialOfferingId) ?? courses[0];
  const selected = chosen === null ? fallback ? [fallback.offering_id] : [] : chosen.filter(id => courses.some(c => c.offering_id === id));
  const scope = selected.map(id => courses.find(c => c.offering_id === id)!);
  const count = mode === "random" ? 5 : questionCount;
  const available = scope.length > 0 && scope.every((c, index) => c.available_questions >= Math.floor(count / scope.length) + (index < count % scope.length ? 1 : 0));
  const compatible = mode === "random" || Boolean(opponent && shared.isSuccess && selected.every(id => shared.data.courses.some(c => c.offering_id === id)));
  const busy = direct.isPending || queue.isPending;
  const clearError = () => { direct.reset(); queue.reset(); };
  const supportsCount = (n: number) => scope.length > 0 && scope.every((c, index) => c.available_questions >= Math.floor(n / scope.length) + (index < n % scope.length ? 1 : 0));
  const toggle = (id: string) => { setChosen(mode === "random" ? [id] : selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]); clearError(); };
  const chooseOpponent = (person: FriendPerson) => { setOpponent(person); clearError(); };
  const ready = available && compatible && (mode !== "random" || scope.length === 1);
  const searching = normalizedInput.length >= 3 && (normalizedInput !== query || search.isFetching);
  const candidates = normalizedInput.length >= 3
    ? normalizedInput === query ? search.data?.people ?? [] : []
    : normalizedInput.length === 0 ? friends.data?.people.filter(p => p.state === "accepted") ?? [] : [];
  return <Card className="battle-setup-card">
    <CardHeader className="battle-setup-heading"><div><CardTitle>Start a battle</CardTitle><CardDescription>Choose subjects, then find an opponent or send a challenge.</CardDescription></div></CardHeader>
    <CardContent className="battle-setup-fields flex flex-col gap-4">
      <div className="battle-setup-subjects">
      {setup.isPending ? <LoadingState label="Loading your subjects…" /> : null}
      <InlineError error={setup.error} />
      {setup.isSuccess && !courses.length ? <Alert title="No battle subjects yet">Your enrolled subjects will appear here when battle questions are published.</Alert> : null}
      <fieldset disabled={busy} className="battle-course-picker">
        <legend className="mb-2 text-sm font-semibold"><span className="battle-step">1</span> {mode === "random" ? "Choose one subject" : "Choose subjects"} <span className="font-normal text-ink-muted">· {selected.length}/{mode === "random" ? 1 : 3} selected</span></legend>
        {courses.map(course => <label key={course.offering_id} className="flex items-center gap-3 rounded-xl border border-line p-3">
          <input type={mode === "random" ? "radio" : "checkbox"} name="battle-subject" checked={selected.includes(course.offering_id)} disabled={mode === "direct" && !selected.includes(course.offering_id) && selected.length >= 3} onChange={() => toggle(course.offering_id)} className="size-4 accent-brand-primary" />
          <span className="min-w-0 flex-1 text-sm"><strong>{course.code}</strong><span className="block text-xs text-ink-muted">{course.title}</span><span className="block text-xs text-ink-muted">{course.available_questions} battle questions</span></span>
        </label>)}
      </fieldset>
      </div>
      <div className="battle-setup-opponent">
      <fieldset disabled={busy} className="battle-mode-picker">
        <legend className="mb-2 text-sm font-semibold"><span className="battle-step">2</span> Choose your match</legend>
        <div className="grid grid-cols-2 gap-2">{([{value:"random",label:"Quick match",description:"Match with a random opponent"},{value:"direct",label:"Challenge someone",description:"Pick your opponent"}] as const).map(({value,label,description}) => <label key={value} className="battle-mode-option">
          <input type="radio" name="battle-mode" value={value} checked={mode === value} onChange={() => { setMode(value); if (value === "random") setChosen(selected.slice(0, 1)); clearError(); }} />
          <span><strong>{label}</strong><small>{description}</small></span>
        </label>)}</div>
      </fieldset>
      {mode === "direct" ? <div className="battle-opponent-search">
        <form className="flex items-end gap-2" onSubmit={e => { e.preventDefault(); setQuery(input.trim().replace(/^@/, "")); setOpponent(null); clearError(); }}>
          <label className="min-w-0 flex-1 text-sm font-semibold">Opponent’s username<Input value={input} disabled={busy} onChange={e => { setInput(e.target.value); setOpponent(null); clearError(); }} placeholder="Type a username…" aria-describedby="battle-search-hint" aria-controls="battle-opponent-results" autoComplete="off" minLength={3} maxLength={60} required type="search" /></label>
          <Button type="submit" variant="outline" disabled={busy} loading={search.isFetching}><Search className="size-4" aria-hidden /><span className="sr-only">Search opponents</span></Button>
        </form>
        <p id="battle-search-hint" className="text-xs text-ink-muted">Type 3 or more characters. Choose a learner, then send a challenge.</p>
        <InlineError error={search.error ?? friends.error} />
        <div id="battle-opponent-results" className="battle-opponent-results max-h-52 overflow-y-auto" role="group" aria-label="Choose opponent" aria-busy={searching}>
          {searching ? <p role="status" className="text-xs text-ink-muted">Finding opponents…</p> : null}
          {!query && candidates.length ? <p className="text-xs font-semibold text-ink-muted">Your friends</p> : null}
          {candidates.map(person => <button type="button" key={person.user_id} disabled={busy} aria-pressed={opponent?.user_id === person.user_id} className="battle-opponent-option" onClick={() => chooseOpponent(person)}><span><strong>{person.display_name}</strong><small>@{person.username}</small></span><span className="text-xs">{opponent?.user_id === person.user_id ? "Selected" : "Choose"}</span></button>)}
          {!searching && normalizedInput.length >= 3 && search.isSuccess && !candidates.length ? <p role="status" className="text-sm text-ink-muted">No opponents found. Try another username.</p> : null}
        </div>
        {opponent ? <div aria-live="polite"><p className="text-sm">Challenging <strong>@{opponent.username}</strong></p>{shared.isPending ? <p className="text-xs text-ink-muted">Checking shared subjects…</p> : null}<InlineError error={shared.error} />{shared.isSuccess && !compatible ? <p className="text-sm text-warning">This learner is not enrolled in all your selected subjects. Update your subjects or choose another opponent.</p> : null}</div> : null}
        <label className="text-sm font-semibold">Questions<NativeSelect value={questionCount} disabled={busy} onChange={e => { setQuestionCount(Number(e.target.value)); clearError(); }}>{[5,10,15,20,25,30].map(n => <option key={n} value={n} disabled={!supportsCount(n)}>{n} questions{supportsCount(n) ? "" : " · not enough questions"}</option>)}</NativeSelect></label>
      </div> : <p className="battle-match-note"><span><strong>Quick matches are 5 questions.</strong> {scope.length > 1 ? "Choose one subject for random matchmaking, or challenge someone across up to three subjects." : "Choose one subject to join the matchmaking queue."}</span></p>}
      </div>
      {setup.isSuccess && scope.length > 0 && !available ? <Alert title="More questions needed">Choose another subject or a smaller question set.</Alert> : null}
      <div className="battle-setup-summary" aria-live="polite"><strong>{count} questions</strong><span>{scope.length ? scope.map(course => course.code).join(" + ") : "Select a subject"}</span></div>
      <Button className="battle-create-button" disabled={busy || !ready} loading={busy} onClick={() => {
        if (mode === "random") queue.mutate({offeringId:selected[0]!},{onSuccess:ack => router.push(ack.battle_id ? `/battles/${ack.battle_id}` : "/battles/queue")});
        else if (opponent) direct.mutate({offeringId:selected[0]!,offeringIds:selected,questionCount,friendId:opponent.user_id},{onSuccess:battle => router.push(`/battles/${battle.battle_id}`)});
      }}>{mode === "random" ? "Find opponent" : "Send challenge"}</Button>
      <BattleActionError error={direct.error ?? queue.error} />
    </CardContent>
  </Card>;
}
