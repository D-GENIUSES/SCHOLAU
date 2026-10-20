import type { Metadata } from "next";
import { PeopleSearch } from "@/components/profile/public-profile-view";

export const metadata: Metadata = { title: "Find people" };
export default function PeoplePage() { return <PeopleSearch />; }
