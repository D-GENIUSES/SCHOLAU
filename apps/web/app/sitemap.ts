import type { MetadataRoute } from "next";
import { publicPages, SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...publicPages.map(({ path }) => ({ url: `${SITE_URL}${path}` })),
    { url: `${SITE_URL}/sign-in` },
    { url: `${SITE_URL}/sign-up` },
    { url: `${SITE_URL}/privacy` },
  ];
}
