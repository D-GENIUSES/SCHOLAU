import type { Metadata } from "next";
import { SocialHub } from "@/components/social/social-hub";

export const metadata: Metadata = { title: "Social" };

export default function SocialPage() {
  return <SocialHub />;
}
