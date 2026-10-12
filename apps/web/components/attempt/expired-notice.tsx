"use client";

import { RefreshCw } from "lucide-react";
import { COPY } from "@scholau/core";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { InlineError, Spinner } from "@/components/ui/states";

export function ExpiredNotice({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <Alert tone="info" role="status" title={COPY.learning.expired} className="mb-4">
      {error ? (
        <div className="flex flex-col gap-2">
          <InlineError error={error} />
          <div>
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="size-4" aria-hidden /> Try again
            </Button>
          </div>
        </div>
      ) : (
        <Spinner label="Grading…" />
      )}
    </Alert>
  );
}
