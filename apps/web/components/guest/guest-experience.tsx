"use client";

import { BookOpen, Settings } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { StreakFlame } from "@/components/icons/streak-flame";
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
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5 sm:gap-6">
      <header className="grid gap-4 rounded-card border border-line bg-linear-to-r from-surface-tint to-surface-page p-4 sm:p-6">
        <p className="content-label">Guest preview</p>
        <nav aria-label="Sample courses" className="grid grid-cols-3 gap-1.5 rounded-xl bg-surface-page p-1.5 sm:max-w-md">
          {guestCourses.map(({ id, title }) => (
            <Link
              key={id}
              href={id === "1" ? "/home" : `/home?course=${id}`}
              aria-current={course.id === id ? "page" : undefined}
              className="grid min-h-11 place-items-center rounded-lg px-1 text-center text-sm font-semibold text-ink-muted hover:bg-surface-tint aria-[current=page]:bg-brand-primary aria-[current=page]:text-white"
            >
              {title}
            </Link>
          ))}
        </nav>
        <div className="home-course-heading"><h1>{course.title}</h1></div>
      </header>
      {[1, 2, 3, 4, 5].map((topic) => (
        <section key={topic} aria-labelledby={`guest-topic-${topic}`} className="overflow-hidden rounded-card border border-line bg-surface-page">
          <h2 id={`guest-topic-${topic}`} className="border-l-4 border-brand-primary bg-surface-tint px-4 py-3 text-base font-semibold text-ink sm:px-5">
            Topic {topic}
          </h2>
          <ul aria-label={`Topic ${topic} lessons`} className="grid list-none gap-3 p-4 sm:grid-cols-3 sm:p-5">
            {[1, 2, 3].map((lesson) => (
              <li key={lesson} className="home-map-node">
                <span className="home-map-node-marker" aria-hidden><BookOpen className="size-4" /></span>
                <span className="home-map-node-title">Lesson {lesson}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
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
