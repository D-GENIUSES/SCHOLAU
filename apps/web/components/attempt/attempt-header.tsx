"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import type { Attempt } from "@scholau/api";
import { ASSESSMENT_KIND_LABEL, COPY } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";

export function AttemptHeader({ attempt, children }: { attempt: Attempt; children?: ReactNode }) {
  const router = useRouter();
  const [leaveOpen, setLeaveOpen] = useState(false);
  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-semibold text-brand-primary">{ASSESSMENT_KIND_LABEL[attempt.kind]}</span>
          <h1 className="text-2xl font-bold">{attempt.title}</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => setLeaveOpen(true)}>
          <LogOut className="size-4" aria-hidden /> Leave
        </Button>
      </div>
      {children}
      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Leave this attempt?"
        description={COPY.learning.leaveAttempt}
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={() => router.push(`/study/courses/${attempt.offering_id}`)}
      />
    </div>
  );
}
