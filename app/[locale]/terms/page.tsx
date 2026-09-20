import { useTranslations } from "next-intl";

export default function TermsPage() {
  const t = useTranslations("Compliance");

  return (
    <div style={{ maxWidth: "var(--container-sm)", margin: "0 auto", padding: "var(--space-12) var(--space-6)" }}>
      <h1 style={{ fontSize: "var(--text-3xl)", fontWeight: "var(--font-weight-bold)", marginBottom: "var(--space-8)" }}>
        {t("termsTitle")}
      </h1>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", color: "var(--color-foreground-secondary)", lineHeight: "var(--leading-loose)" }}>
        <p>{t("termsIntro")}</p>

        <section>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-foreground)", marginBottom: "var(--space-2)" }}>
            {t("termsServiceTitle")}
          </h2>
          <p>{t("termsServiceText")}</p>
        </section>

        <section>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-foreground)", marginBottom: "var(--space-2)" }}>
            {t("termsIpTitle")}
          </h2>
          <p>{t("termsIpText")}</p>
        </section>

        <section>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-foreground)", marginBottom: "var(--space-2)" }}>
            {t("termsProhibitedTitle")}
          </h2>
          <p>{t("termsProhibitedText")}</p>
        </section>
      </div>
    </div>
  );
}
