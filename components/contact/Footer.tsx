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
          maxWidth: "900px",
          margin: "0 auto",
          padding: "0 24px 48px",
        }}
      >
        {/* ── Top gradient divider ── */}
        <div
          aria-hidden="true"
          style={{
            height: "1px",
            background:
              "linear-gradient(90deg, transparent, rgba(124,58,237,0.3), rgba(99,102,241,0.2), transparent)",
            marginBottom: "40px",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "20px",
            textAlign: "center",
          }}
        >
          {/* ── Logo + Brand ── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
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
                fontSize: "1.1rem",
                fontWeight: 700,
                color: "#94a3b8",
                letterSpacing: "-0.01em",
              }}
            >
              {tGlobal("productName")}
            </span>
          </div>

          {/* ── Description ── */}
          <p
            style={{
              fontSize: "13px",
              color: "#475569",
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
              fontSize: "12px",
              color: "#64748b",
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
              gap: "6px",
              padding: "8px 18px",
              borderRadius: "999px",
              background: "rgba(124,58,237,0.08)",
              border: "1px solid rgba(124,58,237,0.15)",
              color: "#a78bfa",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.25s ease",
              letterSpacing: "0.01em",
            }}
          >
            {t("footerCTA", { name: founderName })}
            <ArrowUpRight size={14} style={{ opacity: 0.7 }} />
          </button>

          {/* ── Copyright ── */}
          <p
            style={{
              fontSize: "11px",
              color: "#334155",
              margin: "8px 0 0",
            }}
          >
            © {new Date().getFullYear()} {tGlobal("productName")} · {t("copyright")}
          </p>
        </div>

        <style>{`
          .founder-cta-btn:hover {
            background: rgba(124,58,237,0.15) !important;
            border-color: rgba(124,58,237,0.3) !important;
            color: #c4b5fd !important;
            box-shadow: 0 0 20px rgba(124,58,237,0.12);
          }
        `}</style>
      </footer>

      {/* ── Contact Drawer ── */}
      <ContactDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
