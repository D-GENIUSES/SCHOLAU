import type { Metadata } from "next";
import { CoursePicker } from "@/components/onboarding/course-picker";

export const metadata: Metadata = { title: "Choose your courses" };

export default function OnboardingCoursesPage() {
  return <CoursePicker />;
}
