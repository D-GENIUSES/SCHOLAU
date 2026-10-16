import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getServerSupabase } from "@/lib/supabase/server";
import { lecturerApi } from "@/lib/lecturer-api";
import { PageHeader, Badge } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import { ServiceUnavailable } from "@/components/service-unavailable";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function LecturerPage() {
  const session = await requireSession("/lecturer");
  if (session.kind === "unavailable") return <ServiceUnavailable reference={session.reference} message={session.message} />;
  if (!session.profile.roles.includes("lecturer")) redirect("/lecturer/application");
  let result;
  try { result = await lecturerApi(await getServerSupabase()).courses(); }
  catch { return <ServiceUnavailable reference="SA-LECTURER-COURSES" message="Your teaching assignments could not be loaded. Please try again." />; }
  return <>
    <PageHeader eyebrow="Lecturer workspace" title={`Welcome, ${session.profile.display_name}`} description="Your account is approved. These course offerings have been assigned to you by an administrator." />
    {result.items.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{result.items.map(o=><Card key={o.id}><CardHeader><div><Badge tone="brand">{o.code}</Badge></div><CardTitle>{o.title}</CardTitle></CardHeader><CardContent><p className="text-sm text-ink-muted">{o.university} · {o.department}</p><p className="mt-2 text-sm text-ink-muted">{o.period} · {o.semester}</p></CardContent></Card>)}</div> : <EmptyState title="No teaching courses assigned yet" description="Your lecturer account is active. An administrator will assign the courses you teach. No student enrollment is required." />}
  </>;
}
