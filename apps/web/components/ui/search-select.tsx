"use client";

import { filterAcademicOptions } from "@scholau/core";
import { Check, ChevronDown } from "lucide-react";
import { forwardRef, useRef, useState, type InputHTMLAttributes } from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

export interface SearchOption { value: string; label: string; searchTerms?: string }
type Props = Pick<InputHTMLAttributes<HTMLInputElement>, "id" | "placeholder" | "aria-describedby" | "aria-invalid" | "disabled"> & {
  id: string; options: readonly SearchOption[]; value: string; onChange: (value: string) => void;
  onBlur?: () => void; emptyMessage?: string;
};

/** One control and a bounded overlay, with keyboard selection and screen-reader labels. */
export const SearchSelect = forwardRef<HTMLInputElement, Props>(function SearchSelect({
  id, options, value, onChange, onBlur, emptyMessage = "No matches found.", ...props
}, ref) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const selected = options.find((option) => option.value === value);
  const visible = filterAcademicOptions(options, draft ?? "");
  const index = Math.min(active, Math.max(0, visible.length - 1));
  const choose = (option: SearchOption) => { onChange(option.value); setDraft(null); setOpen(false); };
  const move = (next: number) => {
    const clamped = Math.max(0, Math.min(next, visible.length - 1));
    setActive(clamped);
    listRef.current?.children.item(clamped)?.scrollIntoView({ block: "nearest" });
  };

  return <div className="relative min-w-0">
    <Input {...props} ref={ref} id={id} role="combobox" aria-autocomplete="list" aria-expanded={open}
      aria-controls={`${id}-options`} aria-activedescendant={open && visible.length ? `${id}-option-${index}` : undefined}
      autoComplete="off" value={draft ?? selected?.label ?? ""} className="truncate pr-10"
      onFocus={() => { setOpen(true); setActive(0); }} onClick={() => setOpen(true)}
      onChange={(event) => { setDraft(event.target.value); setOpen(true); setActive(0); if (value) onChange(""); }}
      onBlur={() => { setOpen(false); setDraft(null); onBlur?.(); }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          if (!open) { setOpen(true); setActive(0); }
          else move(index + (event.key === "ArrowDown" ? 1 : -1));
        } else if (event.key === "Enter" && open) {
          event.preventDefault(); if (visible[index]) choose(visible[index]);
        } else if (event.key === "Escape" && open) {
          event.preventDefault(); setOpen(false); setDraft(null);
        } else if (open && (event.key === "Home" || event.key === "End") && event.ctrlKey) {
          event.preventDefault(); move(event.key === "Home" ? 0 : visible.length - 1);
        }
      }} />
    <ChevronDown className="pointer-events-none absolute right-3 top-3.5 size-4 text-ink-muted" aria-hidden />
    {open ? <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-control border border-line bg-surface-card shadow-raised">
      <ul ref={listRef} id={`${id}-options`} role="listbox" aria-label="Matching options" className="max-h-52 overflow-y-auto overscroll-contain py-1">
        {visible.map((option, position) => <li key={option.value} id={`${id}-option-${position}`} role="option"
          aria-selected={option.value === value}
          className={cn("flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-sm leading-snug", position === index ? "bg-blue-50 text-brand-primary" : "text-ink")}
          onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActive(position)} onClick={() => choose(option)}>
          <span className="min-w-0 flex-1">{option.label}</span>{option.value === value ? <Check className="size-4 shrink-0" aria-hidden /> : null}
        </li>)}
      </ul>
      {visible.length === 0 ? <p role="status" className="px-3 py-4 text-sm text-ink-muted">{emptyMessage}</p> : null}
      <p className="border-t border-line px-3 py-2 text-xs text-ink-muted" role="status" aria-live="polite">{visible.length} {visible.length === 1 ? "match" : "matches"} · A–Z</p>
    </div> : null}
  </div>;
});
