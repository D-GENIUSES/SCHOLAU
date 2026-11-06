"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Bell, ChevronRight, CircleHelp, FileText, GraduationCap, ShieldCheck, UserRound } from "lucide-react";
import type { Profile } from "@scholau/api";
import type { RegistrationAcademicInput } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { LegalLinks } from "@/components/legal-links";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ReportDialog } from "@/components/report-dialog";
import { AcademicDetailsCard } from "./academic-details-card";
import { AccountDeletionDialog } from "./account-deletion-dialog";

const NotificationSettings = dynamic(() => import("@/components/notifications/notification-settings").then(m => m.NotificationSettings));
const sections = [
  { id: "account", label: "Account", icon: UserRound },
  { id: "academic", label: "Academic details", icon: GraduationCap },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security & privacy", icon: ShieldCheck },
  { id: "support", label: "Support", icon: CircleHelp },
  { id: "legal", label: "Terms & privacy policy", icon: FileText },
] as const;
type Section = (typeof sections)[number]["id"];

export function ProfileSettings({ profile: p, registration, email, onClose, onEdit }: { profile: Profile; registration: RegistrationAcademicInput | null; email: string | null; onClose: () => void; onEdit: () => void }) {
  const [section, setSection] = useState<Section | null>(null);
  const heading = sections.find(item => item.id === section)?.label ?? "Settings";
  return <>
    <header className="ps-top"><div className="ps-settings-heading"><Button autoFocus variant="ghost" size="icon" aria-label={section ? "Back to settings" : "Back to profile"} onClick={() => section ? setSection(null) : onClose()}><ArrowLeft aria-hidden /></Button><h1>{heading}</h1></div></header>
    {section === null ? <>
      <div className="ps-settings-person"><Avatar name={p.display_name} path={p.avatar_path} size={40} eager /><div><strong>{p.display_name}</strong>{p.username ? <p>@{p.username}</p> : null}</div></div>
      <nav aria-label="Settings sections">{sections.map((item, index) => <div key={item.id}>{index === 0 || index === 4 ? <h2 className="ps-settings-label">{index === 0 ? "Your account" : "Help & information"}</h2> : null}<button className="ps-settings-row" type="button" onClick={() => setSection(item.id)}><item.icon aria-hidden /><span>{item.label}</span><ChevronRight aria-hidden /></button></div>)}</nav>
      <div className="ps-signout"><SignOutButton variant="ghost" size="sm" /></div>
    </> : <section className="ps-settings-content" aria-label={heading}>
      {section === "account" ? <><dl className="ps-account-details"><div><dt>Username</dt><dd>{p.username || p.display_name}</dd></div><div><dt>Email</dt><dd>{email ?? "Not available"}</dd></div></dl><Button variant="outline" size="sm" onClick={onEdit}>Edit profile</Button></> : null}
      {section === "academic" ? <AcademicDetailsCard academic={p.academic} registration={registration} /> : null}
      {section === "notifications" ? <NotificationSettings owner={p.id} /> : null}
      {section === "security" ? <div className="space-y-5"><Link href="/change-password" className="ps-settings-row">Change password <ChevronRight aria-hidden /></Link><div><h2>Leaderboard visibility</h2><p className="ps-muted">{p.leaderboard_visible ? "Your profile appears on leaderboards." : "Your profile is hidden from leaderboards."}</p><Button variant="link" onClick={onEdit}>Manage visibility</Button></div><div className="border-t border-line pt-4"><AccountDeletionDialog /></div></div> : null}
      {section === "support" ? <div className="space-y-4"><ReportDialog targetType="technical" triggerLabel="Contact support" title="Contact support" />{p.roles.includes("admin") ? <Button asChild variant="outline"><Link href="/admin">Admin</Link></Button> : null}</div> : null}
      {section === "legal" ? <LegalLinks /> : null}
    </section>}
  </>;
}
