import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL?.includes("localhost")
  ? process.env.NEXT_PUBLIC_BASE_URL
  : "https://academy.jetschool.id";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/program`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/artikel`, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/daftar`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/faq`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/contact`, changeFrequency: "monthly", priority: 0.4 },
    // Halaman trust/E-E-A-T — membantu kredibilitas situs di mata search engine
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy-policy`, changeFrequency: "yearly", priority: 0.3 },
  ];

  try {
    const [programs, articles] = await Promise.all([
      prisma.program.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true },
      }),
      prisma.article.findMany({
        where: { isPublished: true },
        select: { slug: true, updatedAt: true },
      }),
    ]);

    const programRoutes: MetadataRoute.Sitemap = programs.map((p) => ({
      url: `${SITE_URL}/program/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    const articleRoutes: MetadataRoute.Sitemap = articles.map((a) => ({
      url: `${SITE_URL}/artikel/${a.slug}`,
      lastModified: a.updatedAt,
      changeFrequency: "monthly",
      priority: 0.6,
    }));

    return [...staticRoutes, ...programRoutes, ...articleRoutes];
  } catch {
    // DB belum terhubung — tetap kembalikan rute statis
    return staticRoutes;
  }
}
