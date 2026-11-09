type AgentLogPayload = {
  location: string;
  message: string;
  data?: Record<string, unknown>;
  hypothesisId?: string;
  runId?: string;
};

const SESSION = "2deea9";
const INGEST = "http://127.0.0.1:7636/ingest/7e022d15-f72a-48f6-84e9-0d913b7249b5";

export function agentDebugLog(payload: AgentLogPayload) {
  if (typeof window === "undefined") return;
  const body = { sessionId: SESSION, timestamp: Date.now(), ...payload };
  fetch(INGEST, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": SESSION },
    body: JSON.stringify(body),
  }).catch(() => {});
  fetch("/api/_agent-log", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": SESSION },
    body: JSON.stringify(body),
  }).catch(() => {});
}
