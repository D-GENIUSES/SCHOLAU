"use client";
import { useState } from "react";
import { useAdminOfferings } from "@scholau/api/react";
import { AdminPageHeader } from "@/components/admin/shared";
import { NativeSelect } from "@/components/ui/input";
import { ChallengeEditor } from "@/components/challenges/challenge-editor";
export default function AdminChallengesPage(){ const offerings=useAdminOfferings(); const [offering,setOffering]=useState(""); const rows=(offerings.data??[]).filter(o=>o.status==='published'); return <><AdminPageHeader title="Course challenges" description="Create a scheduled challenge for every enrolled student in a published course." /><label className="mb-5 block max-w-xl text-sm font-semibold">Course<NativeSelect className="mt-1" value={offering} onChange={e=>setOffering(e.target.value)}><option value="">Choose a course</option>{rows.map(o=><option key={o.id} value={o.id}>{o.course?.code} · {o.course?.title} · {o.department?.name}</option>)}</NativeSelect></label>{offering?<ChallengeEditor offering={offering} />:<p className="text-sm text-ink-muted">Select a course to create a challenge.</p>}</>; }
