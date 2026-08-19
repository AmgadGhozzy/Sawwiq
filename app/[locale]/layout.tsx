import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { Inter } from "next/font/google";
import "../globals.css";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { notFound } from "next/navigation";
import JsonLd, {
  buildOrganizationSchema,
  buildWebSiteSchema,
  buildSoftwareApplicationSchema,
} from "@/components/seo/JsonLd";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://sawwiq.com";

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans-arabic",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Global" });
  const tSeo = await getTranslations({ locale, namespace: "SEO" });

  const isAr = locale === "ar";
  const canonicalUrl = `${BASE_URL}/${locale}`;

  return {
    // ── Title Template ──
    // Every page will render as: "Page Title | سَوِّق" or "Page Title | Sawwiq"
    title: {
      default: tSeo("homeTitle"),
      template: `%s | ${t("productName")}`,
    },

    // ── Meta Description ──
    description: tSeo("homeDescription"),

    // ── Canonical + Hreflang ──
    alternates: {
      canonical: canonicalUrl,
      languages: {
        ar: `${BASE_URL}/ar`,
        en: `${BASE_URL}/en`,
        "x-default": `${BASE_URL}/ar`,
      },
    },

    // ── Open Graph ──
    openGraph: {
      type: "website",
      locale: isAr ? "ar_SA" : "en_US",
      alternateLocale: isAr ? "en_US" : "ar_SA",
      url: canonicalUrl,
      siteName: t("productName"),
      title: tSeo("homeTitle"),
      description: tSeo("homeDescription"),
      images: [
        {
          url: `${BASE_URL}/og-image.png`,
          width: 1200,
          height: 630,
          alt: t("productName"),
        },
      ],
    },

    // ── Twitter / X Card ──
    twitter: {
      card: "summary_large_image",
      title: tSeo("homeTitle"),
      description: tSeo("homeDescription"),
      images: [`${BASE_URL}/og-image.png`],
    },

    // ── Misc ──
    metadataBase: new URL(BASE_URL),
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "ar" | "en")) {
    notFound();
  }

  const messages = await getMessages();
  const dir = locale === "ar" ? "rtl" : "ltr";
  const fontClass = locale === "ar" ? ibmPlexSansArabic.variable : inter.variable;
  const fontFamily = locale === "ar" 
    ? "var(--font-ibm-plex-sans-arabic), 'IBM Plex Sans Arabic', sans-serif"
    : "var(--font-inter), 'Inter', sans-serif";

  // Structured data schemas
  const schemas = [
    buildOrganizationSchema(locale),
    buildWebSiteSchema(locale),
    buildSoftwareApplicationSchema(locale),
  ];

  return (
    <html lang={locale} dir={dir} className={fontClass}>
      <head>
        {schemas.map((schema, i) => (
          <JsonLd key={i} data={schema} />
        ))}
      </head>
      <body
        style={{
          minHeight: "100vh",
          background: "#09090b",
          fontFamily,
          margin: 0,
          padding: 0,
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
          color: "#f1f5f9",
        }}
      >
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
