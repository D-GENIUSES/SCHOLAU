import Link from "next/link";
import featured from "./featured-links.json";

/** Optional Adeleke samples. General knowledge on the home page stays the default. */
export function UniversityCourseSamples() {
  return (
    <section className="mt-6" aria-labelledby="university-samples-title">
      <div className="section-heading">
        <h2 id="university-samples-title">Adeleke University samples</h2>
        <span className="text-xs text-ink-muted">Optional</span>
      </div>
      <p className="text-sm text-ink-muted">General knowledge is the default sample. These course topics are extra, with lessons and practice questions. They are not past papers.</p>
      <ul className="course-list sample-course-grid">
        {featured.map((sample) => (
          <li key={sample.href}>
            <Link href={sample.href} className="course-row">
              <span className="course-info"><strong>{sample.code}</strong><small>{sample.title}</small><span className="course-preview-label">{sample.lessons} lessons · {sample.questions} practice questions</span></span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
