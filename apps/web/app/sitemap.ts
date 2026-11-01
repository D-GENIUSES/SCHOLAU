import type { MetadataRoute } from "next";
import { publicCoursePaths } from "@/lib/public-courses/catalog";
import { SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/home` },
    { url: `${SITE_URL}/sign-in` },
    { url: `${SITE_URL}/sign-up` },
    { url: `${SITE_URL}/privacy` },
    ...publicCoursePaths().map(({ path }) => ({ url: `${SITE_URL}${path}` })),
  ];
}
