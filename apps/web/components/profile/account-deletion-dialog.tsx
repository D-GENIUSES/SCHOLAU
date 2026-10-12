"use client";

import { useState } from "react";
import { useReportContent } from "@scholau/api/react";
import { formatDateTime } from "@scholau/core";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";

const BASE_NOTE = "Account deletion request";
const MAX_NOTE = 2000;

/** No self-service deletion RPC exists: this files a support request through report_content_v1. */
export function AccountDeletionDialog() {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const request = useReportContent();

  const submit = () => {
    const extra = note.trim();
    const full = extra ? `${BASE_NOTE}\n\n${extra}` : BASE_NOTE;
    request.mutate({ targetType: "technical", targetId: null, category: "other", note: full.slice(0, MAX_NOTE) });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o && !request.isPending) {
          request.reset();
          setNote("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="danger-outline">Request account deletion</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Request account deletion</DialogTitle>
        {request.isSuccess ? (
          <>
            <Alert tone="success" role="status" title="Your request was sent">
              <p>Our support team will process your request and confirm once your account has been deleted.</p>
              <p className="mt-1 text-ink-muted">
                Request reference: {request.data.report_id}
                <br />
                Sent: {formatDateTime(request.data.created_at)}
              </p>
            </Alert>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogDescription>
              This sends a deletion request to our support team. Your account is not deleted immediately: support handles the
              request and will confirm with you. Deleting your account removes your profile, XP and learning and battle history.
            </DialogDescription>
            <Field id="deletion-note" label="Anything we should know?" optional hint="Please don't include passwords or other sensitive details.">
              <Textarea maxLength={MAX_NOTE - BASE_NOTE.length - 2} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <InlineError error={request.error} />
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button variant="danger" loading={request.isPending} onClick={submit}>
                Send deletion request
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
