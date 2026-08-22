"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
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
        {/* ── Top gradient divider ── */}
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
          {/* ── Logo + Brand ── */}
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
              style={{ opacity: 0.8 }}
            />
            <span
              style={{
                fontSize: "var(--text-md)",
                fontWeight: "var(--font-weight-bold)",
                color: "var(--color-foreground-secondary)",
                letterSpacing: "-0.01em",
              }}
            >
              {tGlobal("productName")}
            </span>
          </div>

          {/* ── Description ── */}
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-foreground-disabled)",
              margin: 0,
              lineHeight: 1.7,
              maxWidth: "320px",
            }}
          >
            {t("footerDescription")}
          </p>

          {/* ── Tagline ── */}
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-foreground-tertiary)",
              margin: 0,
              fontStyle: "italic",
              opacity: 0.7,
            }}
          >
            {t("footerTagline")}
          </p>

          {/* ── Founder CTA ── */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="founder-cta-btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-1)",
              padding: "var(--space-2) var(--space-4-5)",
              borderRadius: "var(--radius-full)",
              background: "var(--color-brand-surface)",
              border: "1px solid var(--color-brand-soft)",
              color: "var(--color-brand-primary)",
              fontSize: "var(--text-sm)",
              fontWeight: "var(--font-weight-semibold)",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "var(--transition-normal)",
              letterSpacing: "0.01em",
            }}
          >
            {t("footerCTA", { name: founderName })}
            <ArrowUpRight size={14} style={{ opacity: 0.7 }} />
          </button>

          {/* ── Copyright ── */}
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

      {/* ── Contact Drawer ── */}
      <ContactDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
