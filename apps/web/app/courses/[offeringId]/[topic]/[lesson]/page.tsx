import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LessonBlocks } from "@/components/lesson/blocks";
import { CourseCrumb, CourseFrame, EditorialNote } from "@/components/public-course/course-frame";
import { publicCatalog, publicLesson } from "@/lib/public-courses/catalog";
import { SITE_URL } from "@/lib/seo";
import type { LessonBlock } from "@scholau/core";

export function generateStaticParams() {
  return publicCatalog.courses.flatMap((course) => course.topics.flatMap((topic) => topic.lessons.map((lesson) => ({
    offeringId: course.slug,
    topic: topic.slug,
    lesson: lesson.slug,
  }))));
}

export async function generateMetadata({ params }: { params: Promise<{ offeringId: string; topic: string; lesson: string }> }): Promise<Metadata> {
  const { offeringId, topic, lesson: lessonSlug } = await params;
  const found = publicLesson(offeringId, topic, lessonSlug);
  if (!found) return {};
  const title = `${found.course.code}: ${found.lesson.title}`;
  const description = found.lesson.objective;
  const path = `/courses/${found.course.slug}/${found.topic.slug}/${found.lesson.slug}`;
  return { title, description, alternates: { canonical: `${SITE_URL}${path}` }, robots: { index: true, follow: true }, openGraph: { title, description, url: `${SITE_URL}${path}` } };
}

export default async function PublicLessonPage({ params }: { params: Promise<{ offeringId: string; topic: string; lesson: string }> }) {
  const { offeringId, topic, lesson: lessonSlug } = await params;
  const found = publicLesson(offeringId, topic, lessonSlug);
  if (!found) notFound();
  return (
    <CourseFrame>
      <CourseCrumb course={found.course} topic={found.topic} lesson={found.lesson.title} />
      <p className="content-label">{found.course.code} lesson</p>
      <h1>{found.lesson.title}</h1>
      <p>{found.lesson.objective}</p>
      <EditorialNote status={found.lesson.editorial_status} />
      <p className="text-sm text-ink-muted">{found.lesson.source}</p>
      <LessonBlocks blocks={found.lesson.blocks as LessonBlock[]} source={{ kind: "catalog-checkpoint", course: found.course.slug, courseCode: found.course.code, topic: found.topic.slug, lesson: found.lesson.slug }} />
    </CourseFrame>
  );
}
