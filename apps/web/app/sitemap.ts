import type { MetadataRoute } from "next";
import { publicCoursePaths } from "@/lib/public-courses/catalog";
import { publicPages, SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...publicPages.map(({ path }) => ({ url: `${SITE_URL}${path}` })),
    ...publicCoursePaths().map(({ path }) => ({ url: `${SITE_URL}${path}` })),
    { url: `${SITE_URL}/sign-in` },
    { url: `${SITE_URL}/sign-up` },
    { url: `${SITE_URL}/privacy` },
  ];
}
