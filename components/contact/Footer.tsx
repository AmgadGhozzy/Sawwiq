"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import ContactDrawer from "./ContactDrawer";

// ---------------------------------------------------------------------------
// Footer — minimal premium footer with founder CTA that opens ContactDrawer
// ---------------------------------------------------------------------------

const FOUNDER_NAME_AR = "أمجد غزي";
const FOUNDER_NAME_EN = "Amgad Ghozzy";

export default function Footer() {
  const t = useTranslations("Contact");
  const tGlobal = useTranslations("Global");
  const locale = useLocale();
  const founderName = locale === "ar" ? FOUNDER_NAME_AR : FOUNDER_NAME_EN;

  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <footer
        style={{
          position: "relative",
          maxWidth: "var(--container-md)",
          margin: "0 auto",
          padding: "0 var(--space-6) var(--space-12)",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            height: "1px",
            background: "var(--gradient-divider)",
            marginBottom: "var(--space-10)",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--space-5)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
            }}
          >
            <Image
              src="/logo.png"
              alt="Sawwiq"
              width={26}
              height={26}
              className="object-contain"
              style={{ opacity: "var(--opacity-muted)" }}
            />
            <span
              style={{
                fontSize: "var(--text-md)",
                fontWeight: "var(--font-weight-bold)",
                color: "var(--color-foreground-secondary)",
                letterSpacing: "var(--tracking-snug)",
              }}
            >
              {tGlobal("productName")}
            </span>
          </div>

          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-foreground-disabled)",
              margin: 0,
              lineHeight: "var(--leading-relaxed)",
              maxWidth: "320px",
            }}
          >
            {t("footerDescription")}
          </p>

          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-foreground-tertiary)",
              margin: 0,
              fontStyle: "italic",
              opacity: "var(--opacity-muted)",
            }}
          >
            {t("footerTagline")}
          </p>

          <button
            onClick={() => setDrawerOpen(true)}
            className="founder-cta-btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-1)",
              padding: "var(--space-1-5) var(--space-4)",
              borderRadius: "var(--radius-full)",
              background: "var(--color-brand-surface)",
              border: "1px solid var(--color-brand-soft)",
              color: "var(--color-brand-primary)",
              fontSize: "var(--text-sm)",
              fontWeight: "var(--font-weight-semibold)",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "var(--transition-normal)",
              letterSpacing: "var(--tracking-btn)",
            }}
          >
            {t("footerCTA", { name: founderName })}
            <ArrowUpRight size={14} style={{ opacity: "var(--opacity-muted)" }} />
          </button>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "var(--space-4)",
              marginTop: "var(--space-4)",
              fontSize: "var(--text-xs)",
              color: "var(--color-foreground-secondary)",
            }}
          >
            <Link href={`/${locale}/terms`} className="hover:text-foreground transition-colors" style={{ textDecoration: "none", color: "inherit" }}>
              {locale === "ar" ? "الشروط والأحكام" : "Terms"}
            </Link>
            <Link href={`/${locale}/privacy`} className="hover:text-foreground transition-colors" style={{ textDecoration: "none", color: "inherit" }}>
              {locale === "ar" ? "سياسة الخصوصية" : "Privacy"}
            </Link>
            <Link href={`/${locale}/refund`} className="hover:text-foreground transition-colors" style={{ textDecoration: "none", color: "inherit" }}>
              {locale === "ar" ? "سياسة الاسترجاع" : "Refund Policy"}
            </Link>
          </div>

          <p
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-foreground-disabled)",
              margin: "var(--space-2) 0 0",
            }}
          >
            © {new Date().getFullYear()} {tGlobal("productName")} · {t("copyright")}
          </p>
        </div>

        <style>{`
          .founder-cta-btn:hover {
            background: var(--color-brand-soft) !important;
            border-color: var(--color-brand-soft) !important;
            color: var(--color-brand-primary) !important;
            box-shadow: var(--shadow-glow);
          }
        `}</style>
      </footer>

      <ContactDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
