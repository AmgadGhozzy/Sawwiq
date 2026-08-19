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
      ? "أداتك الذكية لإنشاء محتوى تسويقي في ثوانٍ."
      : "Your smart tool for creating marketing content in seconds.",
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
      ? "أداتك الذكية لإنشاء محتوى تسويقي في ثوانٍ."
      : "Your smart tool for creating marketing content in seconds.",
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
      ? "منصة ذكية لتوليد المحتوى التسويقي بالذكاء الاصطناعي."
      : "AI platform for generating marketing content.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: isAr ? "تجربة مجانية" : "Free trial",
    },
    inLanguage: [locale],
  };
}
