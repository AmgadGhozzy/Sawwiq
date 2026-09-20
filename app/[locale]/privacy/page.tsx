import { useTranslations } from "next-intl";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/contact/Footer";

export default function PrivacyPage() {
  const t = useTranslations("Compliance");

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background pt-24 pb-10">
        <div style={{ maxWidth: "var(--container-sm)", margin: "0 auto", padding: "0 var(--space-6)" }}>
      <h1 style={{ fontSize: "var(--text-3xl)", fontWeight: "var(--font-weight-bold)", marginBottom: "var(--space-8)" }}>
        {t("privacyTitle")}
      </h1>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", color: "var(--color-foreground-secondary)", lineHeight: "var(--leading-loose)" }}>
        <p>{t("privacyIntro")}</p>

        <section>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-foreground)", marginBottom: "var(--space-2)" }}>
            {t("privacyDataTitle")}
          </h2>
          <p>{t("privacyDataText")}</p>
        </section>

        <section>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-foreground)", marginBottom: "var(--space-2)" }}>
            {t("privacyUsageTitle")}
          </h2>
          <p>{t("privacyUsageText")}</p>
        </section>

        <section>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-foreground)", marginBottom: "var(--space-2)" }}>
            {t("privacyPaymentTitle")}
          </h2>
          <p>{t("privacyPaymentText")}</p>
        </section>
      </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
