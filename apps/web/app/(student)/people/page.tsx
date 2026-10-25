import type { Metadata } from "next";
import { PeopleSearch } from "@/components/profile/public-profile-view";

export const metadata: Metadata = { title: "Find people" };
export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  const query = (typeof q === "string" ? q : "").trim().slice(0, 60);
  return <PeopleSearch key={query} initialQuery={query} />;
}
