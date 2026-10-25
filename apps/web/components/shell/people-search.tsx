"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, ArrowUpLeft, Clock3, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useProfile, useSearchFriends } from "@scholau/api/react";
import { Avatar } from "@/components/ui/avatar";
import { InlineError } from "@/components/ui/states";

export function NavbarPeopleSearch() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const profile = useProfile();
  const historyKey = profile.data?.id ? `scholau.people-search.${profile.data.id}` : null;
  const normalized = input.trim().replace(/^@/, "");
  const results = useSearchFriends(open ? query : "");
  const waiting = normalized !== query || results.isFetching;

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(normalized), 250);
    return () => window.clearTimeout(timer);
  }, [normalized]);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (next) {
      setInput("");
      setQuery("");
      try {
        const saved: unknown = historyKey ? JSON.parse(sessionStorage.getItem(historyKey) ?? "[]") : [];
        setRecent(Array.isArray(saved) ? saved.filter((value): value is string => typeof value === "string" && value.length >= 3 && value.length <= 60).slice(0, 5) : []);
      } catch { setRecent([]); }
    }
  }

  function remember(term: string) {
    const next = [term, ...recent.filter(value => value.toLowerCase() !== term.toLowerCase())].slice(0, 5);
    setRecent(next);
    try { if (historyKey) sessionStorage.setItem(historyKey, JSON.stringify(next)); } catch { /* Search works without storage. */ }
  }

  function showAll() {
    if (normalized.length < 3) return;
    remember(normalized);
    setOpen(false);
    router.push(`/people?q=${encodeURIComponent(normalized)}`);
  }

  return <Dialog.Root open={open} onOpenChange={changeOpen}>
    <Dialog.Trigger className="header-search header-search-trigger" aria-label="Find people">
      <Search size={18} strokeWidth={1.8} aria-hidden="true" />
      <span>Find people</span>
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="people-search-overlay" />
      <Dialog.Content className="people-search-panel" aria-describedby={undefined} onOpenAutoFocus={event => { event.preventDefault(); inputRef.current?.focus(); }}>
        <Dialog.Title className="sr-only">Find people</Dialog.Title>
        <form className="people-search-toolbar" role="search" onSubmit={event => { event.preventDefault(); showAll(); }}>
          <Dialog.Close className="people-search-icon-button" aria-label="Back"><ArrowLeft size={21} aria-hidden="true" /></Dialog.Close>
          <div className="people-search-field">
            <Search size={18} strokeWidth={1.8} aria-hidden="true" />
            <input ref={inputRef} type="search" aria-label="Search people by name or username" placeholder="Search people" value={input} onChange={event => setInput(event.target.value)} maxLength={60} autoComplete="off" enterKeyHint="search" />
            {input ? <button type="button" className="people-search-icon-button" aria-label="Clear search" onClick={() => { setInput(""); inputRef.current?.focus(); }}><X size={17} aria-hidden="true" /></button> : null}
          </div>
        </form>
        <div className="people-search-content">
          {!normalized ? <>
            {recent.length ? <>
              <div className="people-search-section-head"><h2>Recent</h2><button type="button" onClick={() => { setRecent([]); try { if (historyKey) sessionStorage.removeItem(historyKey); } catch { /* Optional storage. */ } }}>Clear all</button></div>
              <ul className="people-search-list">{recent.map(term => <li key={term}><button type="button" className="people-search-result" onClick={() => { setInput(term); inputRef.current?.focus(); }}><Clock3 size={19} aria-hidden="true" /><span>{term}</span><ArrowUpLeft size={16} aria-hidden="true" /></button></li>)}</ul>
            </> : <p className="people-search-message">Find classmates by name or username.</p>}
          </> : normalized.length < 3 ? <p className="people-search-message">Type at least 3 characters.</p> : waiting ? <p className="people-search-message" role="status">Searching…</p> : results.isError ? <><InlineError error={results.error} /><button type="button" className="people-search-all" onClick={() => void results.refetch()}>Try again</button></> : <>
            <ul className="people-search-list" aria-label="People suggestions">{results.data?.people.slice(0, 6).map(person => <li key={person.user_id}>
              <Link className="people-search-result" href={`/people/${person.user_id}`} onClick={() => { remember(normalized); setOpen(false); }}>
                <Avatar name={person.display_name} path={person.avatar_path} publicProfile size={40} />
                <span className="people-search-person"><strong>{person.display_name}</strong>{person.username ? <small>@{person.username}</small> : null}</span>
                <ArrowUpLeft size={16} aria-hidden="true" />
              </Link>
            </li>)}</ul>
            {!results.data?.people.length ? <p className="people-search-message" role="status">No people found.</p> : null}
          </>}
        </div>
        {normalized.length >= 3 ? <button type="button" className="people-search-all" onClick={showAll}>Show all results</button> : null}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
