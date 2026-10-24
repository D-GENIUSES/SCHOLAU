"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAttempt } from "@scholau/api/react";
import { PracticePlayer } from "@/components/attempt/practice-player";
import { ReviewPlayer } from "@/components/attempt/review-player";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState, Spinner } from "@/components/ui/states";

export default function AttemptPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const attempt = useAttempt(id);
  const { refetch } = attempt;
  const status = attempt.data?.status;

  useEffect(() => {
    if (status && status !== "active") router.replace(`/attempts/${id}/results`);
  }, [status, id, router]);

  if (attempt.data) {
    if (attempt.data.status !== "active") return <Spinner label="Opening your results…" />;
    return attempt.data.feedback_mode === "immediate" ? (
      <ReviewPlayer key={attempt.data.attempt_id} attempt={attempt.data} onRefetch={refetch} />
    ) : (
      <PracticePlayer key={attempt.data.attempt_id} attempt={attempt.data} onRefetch={refetch} />
    );
  }
  if (attempt.isError) {
    return (
      <ErrorState
        error={attempt.error}
        onRetry={() => void refetch()}
        action={
          <Button asChild variant="outline">
            <Link href="/study">Back to Study</Link>
          </Button>
        }
      />
    );
  }
  return <LoadingState variant="question" label="Loading your attempt…" />;
}
