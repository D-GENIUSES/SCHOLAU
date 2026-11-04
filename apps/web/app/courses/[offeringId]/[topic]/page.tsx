import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MathText } from "@/components/math/math-text";
import { CourseCrumb, CourseFrame } from "@/components/public-course/course-frame";
import { TopicChecks } from "@/components/public-course/topic-checks";
import { publicCatalog, publicTopic, topicChecks } from "@/lib/public-courses/catalog";
import { SITE_URL } from "@/lib/seo";

export function generateStaticParams() {
  return publicCatalog.courses.flatMap((course) => course.topics.map((topic) => ({ offeringId: course.slug, topic: topic.slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ offeringId: string; topic: string }> }): Promise<Metadata> {
  const { offeringId, topic: topicSlug } = await params;
  const found = publicTopic(offeringId, topicSlug);
  if (!found) return {};
  const title = `${found.course.code} ${found.topic.title}`;
  const description = found.topic.description;
  const path = `/courses/${found.course.slug}/${found.topic.slug}`;
  return { title, description, alternates: { canonical: `${SITE_URL}${path}` }, robots: { index: true, follow: true }, openGraph: { title, description, url: `${SITE_URL}${path}` } };
}

export default async function PublicTopicPage({ params }: { params: Promise<{ offeringId: string; topic: string }> }) {
  const { offeringId, topic: topicSlug } = await params;
  const found = publicTopic(offeringId, topicSlug);
  if (!found) notFound();
  const { pre, post } = topicChecks(found.topic);
  return (
    <CourseFrame>
      <CourseCrumb course={found.course} topic={found.topic} />
      <h1>{found.topic.title}</h1>
      <p>{found.course.code}. Practice questions, not past papers.</p>
      <TopicChecks courseCode={found.course.code} topicKey={found.topic.slug} pre={pre} post={post} />
      <h2>Lessons</h2>
      <ul>
        {found.topic.lessons.map((lesson) => (
          <li key={lesson.slug}><Link href={`/courses/${found.course.slug}/${found.topic.slug}/${lesson.slug}`}>{lesson.title}</Link></li>
        ))}
      </ul>
      <h2>Practice questions</h2>
      <ol>
        {found.topic.questions.slice(0, 10).map((question) => (
          <li key={question.logical_question_key}>
            <p><MathText text={question.prompt} /></p>
            <p className="text-sm text-ink-muted">{question.source_reference}</p>
          </li>
        ))}
      </ol>
      <p><Link href="/study/gaps">Topic gap report</Link></p>
    </CourseFrame>
  );
}
