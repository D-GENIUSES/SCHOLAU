"use client";

import { BookOpen, Settings } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { CourseSelector } from "@/components/home/course-selector";
import { LeaderboardChrome } from "@/components/leaderboard/leaderboard-chrome";
import { LeaderboardList } from "@/components/leaderboard/leaderboard-list";
import { ShellFrame } from "@/components/shell/shell-frame";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { GuestBattles } from "./guest-battles";
import { guestCourses, guestRanking } from "./guest-content";

const accountViews = {
  social: { title: "Social", description: "Sign in to find classmates and manage your friends." },
  profile: { title: "Profile", description: "Sign in to open your profile." },
  mock: { title: "Mock exams", description: "Sign in to try timed assessments and track your results." },
};

export function GuestExperience() {
  const params = useSearchParams();
  const view = params.get("view");
  const course = guestCourses.find(({ offering_id }) => offering_id === params.get("course")) ?? guestCourses[0];
  let pathname = "/home";
  let content: ReactNode;

  switch (view) {
    case "battles":
      pathname = "/battles";
      content = <GuestBattles />;
      break;
    case "leaderboard":
      pathname = "/leaderboard";
      content = <GuestLeaderboard />;
      break;
    case "social":
    case "profile":
    case "mock": {
      pathname = view === "mock" ? "/home" : `/${view}`;
      const { title, description } = accountViews[view];
      content = <section className="account-prompt"><h1>{title}</h1><p>{description}</p><AccountLinks next={pathname} /></section>;
      break;
    }
    default:
      content = <GuestHome key={course.offering_id} initialCourse={course} />;
  }

  return <ShellFrame guest pathname={pathname} guestControls={<GuestControls next={pathname} />}>{content}</ShellFrame>;
}

function GuestHome({ initialCourse }: { initialCourse: typeof guestCourses[number] }) {
  const [selectedId, setSelectedId] = useState(initialCourse.offering_id);
  const [menuOpen, setMenuOpen] = useState(false);
  const selected = guestCourses.find(({ offering_id }) => offering_id === selectedId) ?? initialCourse;
  return (
    <div className="home-dashboard compact-home home-dashboard-course">
      <div className="home-course-focus">
        <p className="content-label">Guest preview</p>
        <CourseSelector
          preview
          courses={guestCourses}
          selectedId={selectedId}
          open={menuOpen}
          onOpenChange={setMenuOpen}
          onSelect={setSelectedId}
        />
        <header className="home-course-heading"><h1>{selected.title}</h1></header>
        <ul aria-label="Sample lessons" className="grid list-none gap-3">
          {["Lesson 1", "Lesson 2", "Lesson 3"].map((label) => (
            <li key={label} className="home-map-node">
              <span className="home-map-node-marker" aria-hidden><BookOpen className="size-4" /></span>
              <span className="home-map-node-title">{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function GuestLeaderboard() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <LeaderboardChrome />
      <p className="content-label">Sample leaderboard</p>
      <LeaderboardList readOnly rows={guestRanking} label="Sample leaderboard" />
      <AccountLinks next="/leaderboard" />
    </div>
  );
}

function AccountLinks({ next }: { next: string }) {
  const destination = encodeURIComponent(next);
  return (
    <div className="flex flex-wrap justify-center gap-3">
      <Button asChild><Link href={`/sign-up?next=${destination}`}>Create account</Link></Button>
      <Button asChild variant="outline"><Link href={`/sign-in?next=${destination}`}>Sign in</Link></Button>
    </div>
  );
}

function GuestControls({ next }: { next: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="notification-button" aria-label="Guest settings"><Settings className="size-5" aria-hidden /></button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogTitle>Guest settings</DialogTitle>
        <DialogDescription>Sign in or create an account to use ScholAu.</DialogDescription>
        <AccountLinks next={next} />
      </DialogContent>
    </Dialog>
  );
}
