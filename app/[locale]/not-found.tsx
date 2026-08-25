import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--color-background)",
        padding: "var(--space-6)",
      }}
    >
      <div
        style={{
          fontSize: "var(--text-hero-num)",
          fontWeight: "var(--font-weight-bold)",
          background: "var(--gradient-headline)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          lineHeight: 1,
          marginBottom: "var(--space-4)",
        }}
      >
        404
      </div>
      <h2
        style={{
          fontSize: "var(--text-xl)",
          fontWeight: "var(--font-weight-bold)",
          color: "var(--color-foreground)",
          marginBottom: "var(--space-2)",
        }}
      >
        {t("title")}
      </h2>
      <p
        style={{
          color: "var(--color-foreground-secondary)",
          marginBottom: "var(--space-6)",
          textAlign: "center",
          maxWidth: "var(--container-sm)",
        }}
      >
        {t("description")}
      </p>
      <Link
        href="/"
        style={{
          padding: "var(--space-3) var(--space-6)",
          borderRadius: "var(--radius-md)",
          background: "var(--color-brand-primary)",
          color: "var(--color-foreground-inverse)",
          textDecoration: "none",
          fontSize: "var(--text-base)",
          fontWeight: "var(--font-weight-semibold)",
          transition: "background var(--transition-fast)",
        }}
      >
        {t("backHome")}
      </Link>
    </div>
  );
}
