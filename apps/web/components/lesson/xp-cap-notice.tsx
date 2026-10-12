import { COPY } from "@scholau/core";
import { Alert } from "@/components/ui/alert";

export function XpCapNotice({ className }: { className?: string }) {
  return (
    <Alert tone="warning" title={COPY.learning.capReached} className={className}>
      {COPY.learning.capReset}
    </Alert>
  );
}
