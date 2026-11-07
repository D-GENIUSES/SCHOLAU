"use client";

import { Copy, Ellipsis, Flag, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ReportDialog } from "@/components/report-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { studyInvitation, studyShareErrorMessage, type StudyLink, type StudyReport, type StudyShareErrorCode, type StudySource } from "@/lib/shared-study";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export function QuestionActions({
  source, report, link, signInHref, startReport, shareable = true,
}: {
  source?: StudySource;
  report: StudyReport;
  link?: StudyLink;
  signInHref?: string;
  startReport?: boolean;
  shareable?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [dialog, setDialog] = useState<"share" | "report" | null>(startReport ? "report" : null);
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const router = useRouter();

  useEffect(() => {
    if (!expanded) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) setExpanded(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [expanded]);

  async function openReport() {
    setExpanded(false);
    if (signInHref) {
      router.push(signInHref);
      return;
    }
    if (source?.kind === "catalog" || source?.kind === "catalog-checkpoint") {
      const { data } = await getBrowserSupabase().auth.getSession();
      if (!data.session) {
        const next = window.location.pathname + window.location.search;
        router.push(`/sign-in?next=${encodeURIComponent(next)}`);
        return;
      }
    }
    setDialog("report");
  }

  function restoreFocus(event: Event) {
    event.preventDefault();
    trigger.current?.focus();
  }

  return (
    <div
      ref={wrapper}
      className="relative shrink-0"
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setExpanded(false);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !expanded) return;
        event.stopPropagation();
        setExpanded(false);
        trigger.current?.focus();
      }}
    >
      <Button
        ref={trigger}
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Question actions"
        aria-expanded={expanded}
        aria-controls={menuId}
        onClick={() => setExpanded(!expanded)}
      >
        <Ellipsis className="size-5" aria-hidden />
      </Button>
      <div id={menuId} hidden={!expanded} className="absolute right-0 top-full z-20 w-48 rounded-control border border-line bg-surface-card p-1 shadow-raised">
        {shareable ? <Button type="button" variant="ghost" className="w-full justify-start" onClick={() => { setExpanded(false); setDialog("share"); }}>
          <Share2 className="size-4" aria-hidden /> Share question
        </Button> : null}
        <Button type="button" variant="ghost" className="w-full justify-start" onClick={() => void openReport()}>
          <Flag className="size-4" aria-hidden /> Report question
        </Button>
      </div>
      {dialog === "share" ? <ShareDialog source={source} existingLink={link} close={() => setDialog(null)} restoreFocus={restoreFocus} /> : null}
      <ReportDialog
        {...report}
        title="Report question"
        controlledOpen={dialog === "report"}
        onControlledOpenChange={(open) => setDialog(open ? "report" : null)}
        onCloseAutoFocus={restoreFocus}
      />
    </div>
  );
}

function ShareDialog({
  source, existingLink, close, restoreFocus,
}: {
  source?: StudySource;
  existingLink?: StudyLink;
  close: () => void;
  restoreFocus: (event: Event) => void;
}) {
  const [link, setLink] = useState(existingLink);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [manualCopy, setManualCopy] = useState(false);

  useEffect(() => {
    if (existingLink || !source) return;
    const controller = new AbortController();
    async function prepare() {
      try {
        const response = await fetch("/api/shared-questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(source),
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { code?: StudyShareErrorCode } | null;
          if (body?.code) {
            setError(studyShareErrorMessage(body.code));
            return;
          }
          if (response.status === 404) {
            setError(studyShareErrorMessage("not_shareable"));
            return;
          }
          throw new Error();
        }
        setLink(await response.json() as StudyLink);
      } catch {
        if (!controller.signal.aborted) setError("Couldn’t prepare the link. Close this panel and try again.");
      }
    }
    void prepare();
    return () => controller.abort();
  }, [existingLink, source]);

  const invitation = link ? studyInvitation(link.topic) : "";

  async function copy(instagram = false) {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setStatus(instagram ? "Link copied. Open Instagram and paste it into a direct message." : "Link copied.");
    } catch {
      setManualCopy(true);
      setStatus(instagram ? "Copy the link below, then paste it into an Instagram direct message." : "Select and copy the link below.");
    }
  }

  async function nativeShare() {
    if (!link) return;
    try {
      await navigator.share({ text: invitation, url: link.url });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setManualCopy(true);
        setStatus("Sharing is unavailable. You can copy the link below.");
      }
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent onCloseAutoFocus={restoreFocus}>
        <DialogTitle>Share question</DialogTitle>
        <DialogDescription>Challenge a friend with a single ScholAu question.</DialogDescription>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : link ? (
          <>
            <p className="rounded-control bg-surface-tint p-3 text-sm">{invitation}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button asChild variant="outline"><a target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${invitation}\n${link.url}`)}`}>WhatsApp</a></Button>
              <Button asChild variant="outline"><a target="_blank" rel="noopener noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link.url)}`}>Facebook</a></Button>
              <Button type="button" variant="outline" onClick={() => void copy(true)}>Instagram</Button>
              {typeof navigator.share === "function" ? <Button type="button" variant="outline" onClick={() => void nativeShare()}>More options</Button> : null}
              <Button type="button" variant="outline" onClick={() => void copy()}><Copy className="size-4" aria-hidden /> Copy link</Button>
            </div>
            <p role="status" className="empty:hidden text-sm text-ink-muted">{status}</p>
            {manualCopy ? <input className="min-h-11 w-full rounded-control border border-line px-3 text-sm" aria-label="Share link" readOnly value={link.url} onFocus={(event) => event.currentTarget.select()} /> : null}
          </>
        ) : <p role="status" className="text-sm text-ink-muted">Preparing your link…</p>}
      </DialogContent>
    </Dialog>
  );
}