import type { MetadataRoute } from "next";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://sawwiq.com";

const LOCALES = ["ar", "en"] as const;

/**
 * All routes that should appear in the sitemap.
 * Add new routes here as the site grows.
 */
const ROUTES = [
  "/", // Homepage
];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const route of ROUTES) {
    for (const locale of LOCALES) {
      const path = route === "/" ? "" : route;
      const url = `${BASE_URL}/${locale}${path}`;

      // Build alternates for this page across all locales
      const languages: Record<string, string> = {};
      for (const alt of LOCALES) {
        languages[alt] = `${BASE_URL}/${alt}${path}`;
      }
      // x-default points to the default locale (Arabic)
      languages["x-default"] = `${BASE_URL}/ar${path}`;

      entries.push({
        url,
        lastModified: new Date(),
        changeFrequency: route === "/" ? "weekly" : "monthly",
        priority: route === "/" ? 1.0 : 0.8,
        alternates: { languages },
      });
    }
  }

  return entries;
}
