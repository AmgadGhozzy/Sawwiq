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
    name: isAr ? "سَوِّق" : "Sawwiq",
    url: `${BASE_URL}/${locale}`,
    logo: `${BASE_URL}/logo.png`,
    description: isAr
      ? "منصة سَوِّق لتوليد بوستات إعلانية، سكريبتات فيديو، ومحتوى تسويقي بجميع اللهجات العربية وأطر الإقناع العالمية."
      : "AI-powered marketing content generator for high-converting ads, viral video scripts, and social posts across Arabic dialects and English.",
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
    name: isAr ? "سَوِّق" : "Sawwiq",
    url: `${BASE_URL}/${locale}`,
    inLanguage: locale,
    description: isAr
      ? "ولّد بوستات وإعلانات وسكريبتات فيديو جاهزة للنشر بأي لهجة عربية أو بالإنجليزي — في ثوانٍ. مجاني، بدون بطاقة ائتمان."
      : "Generate high-converting social posts, ad copy, and viral video scripts across Arabic dialects and English — free, in seconds.",
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
    applicationSubCategory: "Marketing & Copywriting",
    operatingSystem: "All",
    screenshot: `${BASE_URL}/og-image.png`,
    description: isAr
      ? "منصة ذكية متخصصة في توليد نصوص تسويقية عالية التحويل — عناوين جاذبة، افتتاحيات توقف التمرير، أطر إقناع مثبتة، ودعوات واضحة لاتخاذ إجراء."
      : "AI-powered conversion copywriting platform — crafting scroll-stopping hooks, high-converting ad copy, and native dialect marketing assets.",
    featureList: isAr
      ? [
          "توليد محتوى تسويقي وإعلاني بجميع اللهجات العربية",
          "تطبيق أطر الإقناع والتسويق العالمية (AIDA و PAS)",
          "تخصيص شخصيات كتابة وصناع محتوى متعددة",
          "هندسة افتتاحيات (Hooks) ودعوات لاتخاذ إجراء (CTAs)",
          "توليد هاشتاغات ذكية متوافقة مع خوارزميات المنصات"
        ]
      : [
          "Multi-dialect Arabic & English AI marketing copy",
          "Persuasion copywriting frameworks (AIDA, PAS, StoryBrand)",
          "Tailored creator personas and signature voices",
          "Scroll-stopping hook and conversion CTA engineering",
          "Platform-optimized character limits and algorithmic hashtags"
        ],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: isAr ? "مجاني — بدون بطاقة ائتمان" : "Free — no credit card required",
    },
    inLanguage: [locale],
  };
}
