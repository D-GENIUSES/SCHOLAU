import { redirect } from "next/navigation";

/** Legacy /study catalog — learning lives on Home. */
export default function StudyIndexPage() {
  redirect("/home");
}
