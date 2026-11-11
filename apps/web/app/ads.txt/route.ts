import { adsensePublisher } from "@/lib/adsense";

export function GET() {
  if (!adsensePublisher) return new Response(null, { status: 404 });

  return new Response(
    `google.com, ${adsensePublisher.slice(3)}, DIRECT, f08c47fec0942fa0\n`,
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}
