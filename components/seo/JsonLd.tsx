/**
 * Reusable JSON-LD structured data component.
 * Renders <script type="application/ld+json"> in <head> via Next.js metadata.
 * Usage: <JsonLd data={schema} />
 */

type JsonLdProps = {
  data: Record<string, unknown> | Record<string, unknown>[];
};

export default function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/* ─── Schema Builders ─── */

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://sawwiq.com";

/**
 * Organization schema — identifies Sawwiq as a legal entity.
 */
export function buildOrganizationSchema(locale: string) {
  const isAr = locale === "ar";
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: isAr ? "سوّق" : "Sawwiq",
    url: `${BASE_URL}/${locale}`,
    logo: `${BASE_URL}/logo.png`,
    description: isAr
      ? "ولّد بوستات وإعلانات وسكريبتات فيديو جاهزة للنشر بأي لهجة عربية أو بالإنجليزي — في ثوانٍ. مجاني، بدون بطاقة ائتمان."
      : "Generate scroll-stopping posts, ads, and video scripts in any Arabic dialect or English — free, in seconds. No credit card required.",
    sameAs: [],
  };
}

/**
 * WebSite schema — enables Sitelinks Search Box in Google.
 */
export function buildWebSiteSchema(locale: string) {
  const isAr = locale === "ar";
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: isAr ? "سوّق" : "Sawwiq",
    url: `${BASE_URL}/${locale}`,
    inLanguage: locale,
    description: isAr
      ? "ولّد بوستات وإعلانات وسكريبتات فيديو جاهزة للنشر بأي لهجة عربية أو بالإنجليزي — في ثوانٍ. مجاني، بدون بطاقة ائتمان."
      : "Generate scroll-stopping posts, ads, and video scripts in any Arabic dialect or English — free, in seconds. No credit card required.",
  };
}

/**
 * SoftwareApplication schema — for SaaS rich results.
 */
export function buildSoftwareApplicationSchema(locale: string) {
  const isAr = locale === "ar";
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: isAr ? "سَوِّق" : "Sawwiq",
    url: `${BASE_URL}/${locale}`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: isAr
      ? "منصة ذكية لتوليد محتوى تسويقي بالذكاء الاصطناعي — عناوين، افتتاحيات، هاشتاغات، ودعوات عمل."
      : "AI-powered platform for generating marketing content — headlines, hooks, hashtags, and CTAs.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: isAr ? "مجاني — بدون بطاقة ائتمان" : "Free — no credit card required",
    },
    inLanguage: [locale],
  };
}
