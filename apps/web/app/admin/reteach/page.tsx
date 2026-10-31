"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { newRequestKey } from "@scholau/api";
import { useScholauApi } from "@scholau/api/react";
import { AdminPageHeader } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/states";

export default function AdminReteachPage() {
  const api = useScholauApi();
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["scholau", "admin", "ingestion-reteach"],
    queryFn: () => api.admin.listIngestionReteach(50),
  });
  const queue = useMutation({
    mutationFn: (jobId: string) => api.admin.queueIngestionReteach({ jobId, requestKey: newRequestKey() }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["scholau", "admin", "ingestion-reteach"] }),
  });

  return (
    <>
      <AdminPageHeader
        title="Re-teach from sources"
        description="Re-run succeeded material ingestion jobs with updated Khan-style prompts. New drafts are created for review before publish."
      />
      <p className="mb-4 max-w-2xl text-sm text-ink-muted">
        Each re-teach queues a new ingestion job with force reprocess. Review generated lesson versions in the admin review queue before publishing.
      </p>
      {list.isPending ? <LoadingState label="Loading ingestion jobs…" lines={4} /> : null}
      {list.isError ? <p role="alert">Could not load ingestion jobs.</p> : null}
      {list.data?.items?.length ? (
        <ul className="flex max-w-3xl flex-col gap-2">
          {list.data.items.map((item) => (
            <li key={item.job_id} className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-line bg-surface-card px-4 py-3">
              <div className="min-w-0">
                <p className="font-semibold">{item.course_code}</p>
                <p className="truncate text-sm text-ink-muted">{item.filename}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                loading={queue.isPending && queue.variables === item.job_id}
                onClick={() => queue.mutate(item.job_id)}
              >
                Re-teach
              </Button>
            </li>
          ))}
        </ul>
      ) : list.isSuccess ? <p>No succeeded ingestion jobs found.</p> : null}
      {queue.isSuccess ? <p className="mt-4 text-sm text-success" role="status">Re-teach job queued. Watch the ingestion worker for progress.</p> : null}
    </>
  );
}
