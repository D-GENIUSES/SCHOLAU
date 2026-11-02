import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseCrumb, CourseFrame } from "@/components/public-course/course-frame";
import { publicCatalog, publicCourse } from "@/lib/public-courses/catalog";
import { SITE_URL } from "@/lib/seo";

export function generateStaticParams() {
  return publicCatalog.courses.map((course) => ({ offeringId: course.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ offeringId: string }> }): Promise<Metadata> {
  const { offeringId } = await params;
  const course = publicCourse(offeringId);
  if (!course) return {};
  const title = `${course.code} ${course.title}`;
  return {
    title,
    description: course.description,
    alternates: { canonical: `${SITE_URL}/courses/${course.slug}` },
    robots: { index: true, follow: true },
    openGraph: { title, description: course.description, url: `${SITE_URL}/courses/${course.slug}` },
  };
}

export default async function PublicCoursePage({ params }: { params: Promise<{ offeringId: string }> }) {
  const { offeringId } = await params;
  const course = publicCourse(offeringId);
  if (!course) notFound();
  return (
    <CourseFrame>
      <CourseCrumb course={course} />
      <h1>{course.code}</h1>
      <p>{course.title}. {course.description}</p>
      <ul className="course-list">
        {course.topics.map((topic) => (
          <li key={topic.slug}>
            <Link href={`/courses/${course.slug}/${topic.slug}`} className="course-row">
              <span className="course-info"><strong>{topic.title}</strong><small>{topic.lessons.length} lessons · {topic.questions.length} practice questions</small></span>
            </Link>
          </li>
        ))}
      </ul>
    </CourseFrame>
  );
}
