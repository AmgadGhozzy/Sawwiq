import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import WorkspaceNavbar from "@/components/layout/WorkspaceNavbar";
import { HistoryContextProvider } from "@/components/history/HistoryContext";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Global" });
  const tSeo = await getTranslations({ locale, namespace: "SEO" });

  return {
    title: `${locale === "ar" ? "أداة التوليد" : "Generate"} | ${t("productName")}`,
    description: tSeo("homeDescription"),
    robots: { index: false, follow: false },
  };
}

export default function GenerateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HistoryContextProvider>
      <div className="h-dvh flex flex-col overflow-hidden">
        <WorkspaceNavbar />
        {/* Workspace content region */}
        <div className="flex-1 min-h-0 flex flex-col">
          {children}
        </div>
      </div>
    </HistoryContextProvider>
  );
}
