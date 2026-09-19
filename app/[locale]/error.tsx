"use client";

import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("ErrorPage");
  console.error(error);

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
          width: "64px",
          height: "64px",
          borderRadius: "var(--radius-circle)",
          background: "var(--color-danger-surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "var(--space-6)",
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-danger)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h2
        style={{
          fontSize: "var(--text-2xl)",
          fontWeight: 700,
          color: "var(--color-foreground)",
          marginBottom: "var(--space-2)",
        }}
      >
        {t("title")}
      </h2>
      <p
        style={{
          color: "var(--color-foreground-tertiary)",
          marginBottom: "var(--space-6)",
          textAlign: "center",
          maxWidth: "400px",
        }}
      >
        {t("description")}
      </p>
      <Button
        onClick={reset}
        size="lg"
      >
        {t("retry")}
      </Button>
    </div>
  );
}
