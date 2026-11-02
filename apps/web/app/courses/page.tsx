import type { Metadata } from "next";
import Link from "next/link";
import { CourseFrame } from "@/components/public-course/course-frame";
import { publicCatalog } from "@/lib/public-courses/catalog";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Adeleke University course samples",
  description: "Free STA 111, STA 112, STA 121 and BIO 101 lessons and practice questions on ScholAu.",
  alternates: { canonical: `${SITE_URL}/courses` },
  robots: { index: true, follow: true },
};

export default function CoursesPage() {
  return (
    <CourseFrame>
      <h1>Course samples</h1>
      <p>General knowledge stays on the home page. These Adeleke University courses are optional samples. Questions are practice items, not past papers.</p>
      <ul className="course-list">
        {publicCatalog.courses.map((course) => (
          <li key={course.slug}>
            <Link href={`/courses/${course.slug}`} className="course-row">
              <span className="course-info"><strong>{course.code}</strong><small>{course.title}</small></span>
            </Link>
          </li>
        ))}
      </ul>
    </CourseFrame>
  );
}
