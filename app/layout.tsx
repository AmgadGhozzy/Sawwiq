import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { appConfig } from "@/lib/config";

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans-arabic",
});

export const metadata: Metadata = {
  title: `${appConfig.productName} | ${appConfig.productTagline}`,
  description: "منصة توليد المحتوى التسويقي بالذكاء الاصطناعي",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={ibmPlexSansArabic.variable}>
      <body
        style={{
          minHeight: "100vh",
          background: "#09090b",
          fontFamily: "var(--font-ibm-plex-sans-arabic), 'IBM Plex Sans Arabic', sans-serif",
          margin: 0,
          padding: 0,
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
          color: "#f1f5f9",
        }}
      >
        {children}
      </body>
    </html>
  );
}
