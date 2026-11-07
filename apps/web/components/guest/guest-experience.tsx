"use client";

import { Settings } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type ReactNode, useState } from "react";
import { CourseLearningMap } from "@/components/home/course-learning-map";
import { CourseSelector } from "@/components/home/course-selector";
import { StreakFlame } from "@/components/icons/streak-flame";
import { LeaderboardChrome } from "@/components/leaderboard/leaderboard-chrome";
import { LeaderboardList } from "@/components/leaderboard/leaderboard-list";
import { ShellFrame } from "@/components/shell/shell-frame";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { GuestBattles } from "./guest-battles";
import { guestCourseOptions, guestCourses, guestModules, guestRanking } from "./guest-content";

const accountViews = {
  social: { title: "Social", description: "Sign in to find classmates and manage your friends." },
  profile: { title: "Profile", description: "Sign in to open your profile." },
  mock: { title: "Mock exams", description: "Sign in to try timed assessments and track your results." },
};

export function GuestExperience() {
  const params = useSearchParams();
  const view = params.get("view");
  const course = guestCourses.find(({ id }) => id === params.get("course")) ?? guestCourses[0];
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
      content = <GuestHome course={course} />;
  }

  return <ShellFrame guest pathname={pathname} guestControls={<GuestControls next={pathname} />}>{content}</ShellFrame>;
}

function GuestHome({ course }: { course: typeof guestCourses[number] }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="home-dashboard compact-home home-dashboard-course">
      <div className="home-course-focus">
        <p className="content-label">Guest preview</p>
        <CourseSelector
          preview
          courses={guestCourseOptions}
          selectedId={course.id}
          open={menuOpen}
          onOpenChange={setMenuOpen}
          onSelect={(id) => window.history.replaceState(null, "", id === "1" ? "/home" : `/home?course=${id}`)}
        />
        <header className="home-course-heading"><h1>{course.title}</h1></header>
        <CourseLearningMap
          preview
          continueLessonId={null}
          overview={{
            offering_id: course.id,
            progress: { lessons_total: 15, lessons_completed: 0, percent: 0 },
            modules: guestModules,
          }}
        />
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
    <>
      <span className="grid size-9 shrink-0 place-items-center" aria-hidden><StreakFlame active size={23} /></span>
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
    </>
  );
}
