import type { Metadata } from "next";
import { CoursePicker } from "@/components/onboarding/course-picker";

export const metadata: Metadata = { title: "Your courses" };

export default function OnboardingCoursesPage() {
  return <CoursePicker />;
}
