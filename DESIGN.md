# Sawwiq — Design Constitution (v1)

Benchmark: Linear (dark depth) + Raycast (command engine) + Poppy AI (density).
This file is law. Any UI code that contradicts it is wrong by definition.

---

## 1. Non-negotiables (taboos)

1. **One ambient effect per viewport.** Hero gets a single quiet spotlight.
   No orb fields, no infinite glows on cards. Permitted infinite motion:
   text caret, loading spinner, skeleton shimmer, recording/status pulse.
2. **Interaction budget: ≤150ms.** Menus, buttons, toggles, modal/sheet/drawer
   open-close complete in ≤150ms `ease-out`. Entrances (scroll reveals) ≤400ms,
   once, no stagger beyond 2 steps × 60ms. No springs slower than 200ms; no
   bounces, ever.
3. **No neon or default glass.** Base is solid dark zinc, never bright color.
   Violet exists ONLY as:
   focus rings, primary CTA fill, active-status indicators. Everything else is
   zinc/neutral/white-alpha.
4. **RTL is structural, not patched.** Logical props only (`start/end`,
   `ps/pe/ms/me`, `border-s`, `text-start`). Zero physical `left/right` in new
   code. No marquee that reverses Arabic reading order. Every fetched component
   is audited for physical properties before merge.
5. **Motion package: `framer-motion` only.** Rewrite `from "motion/react"`
   imports on sight. No parallel animation runtimes on React 19.

## 2. Color tokens (`:root` dark-default; `.light` mirrors per Phase-2 pattern)

```css
--color-background: #09090b;            /* zinc-950, untouched */
--color-surface: #111113;                         /* base panel */
--color-surface-elevated: #171719;                /* raised canvas */
--color-surface-flyout: #1a1a1d;                  /* menus, sheets, editor */
--color-surface-hover: #1f1f22;
--color-surface-translucent: #111113;             /* legacy alias; not glass */
--color-overlay: rgba(0, 0, 0, 0.6);

--color-foreground: #f8fafc;            /* 19:1 — body text */
--color-foreground-secondary: #94a3b8;  /* ~7:1 — descriptions */
--color-foreground-tertiary: #64748b;   /* ~4.5:1 — meta only, never small body */
--color-foreground-disabled: #475569;   /* decorative only, never text */

--color-border: rgba(255, 255, 255, 0.08);
--color-border-subtle: rgba(255, 255, 255, 0.05);
--color-border-focus: #5e6ad2;          /* = brand-primary */

/* Brand — Linear indigo, not raw violet */
--color-brand-primary: #5e6ad2;         /* CTA fills, white text ≥4.5:1 */
--color-brand-hover: #4f46e5;
--color-brand-soft: rgba(94, 106, 210, 0.16);
--color-brand-surface: rgba(94, 106, 210, 0.08);
--color-brand-light: #9ea2f2;           /* luminous accent on dark only */

--gradient-brand: linear-gradient(135deg, #5e6ad2 0%, #4f46e5 100%);
--gradient-headline: linear-gradient(135deg, #fafafa 0%, #d6d8f5 45%, #9ea2f2 100%);
--gradient-hero-spotlight: radial-gradient(ellipse, rgba(94,106,210,0.12) 0%, transparent 70%);
```

Status/WhatsApp/platform tokens unchanged. Orb gradients `orb-1..4`:
**deleted** (replaced by the single spotlight above).

## 3. Typography

- AR body: IBM Plex Sans Arabic · EN body: Inter (dir-switched `--font-sans`,
  Phase-2 mechanism). Wordmark + numerals: Outfit (Latin only — Arabic
  wordmark falls back, never force Outfit on Arabic script).
- Scale: existing `--text-*` clamp ramp stays. Rules: hero `display/bold/tight`,
  section titles `4xl/bold/tight`, card titles `base/bold`, body Arabic
  `leading-relaxed` minimum (1.75+), meta `xs/tertiary`, never `disabled` for text.
- Eyebrow pattern (badge pill): `xs/semibold/brand-light` on `brand-surface`
  + `brand-soft` border, **always above** the headline, never below content.

## 4. Radii, shadows, spacing

- Radii: keep scale. Cards `xl/2xl`, inputs/triggers `md/lg`, pills `full`,
  sheet/modal `2xl`. Generator card → `2xl`.
- Shadows: `card` for resting panels, `elevated` for overlays/sheets,
  `brand-glow` ONLY on primary-CTA hover/focus. No colored shadows elsewhere.
- Spacing: section rhythm `py-20/24` via one Section pattern (kill the 4×
  copy-paste). Card padding `5–6`. Gaps: related `2–3`, groups `5–6`.

## 5. Component recipes

- **Button primary**: indigo fill, white text, `h-10/11`, `rounded-xl`,
  `text-sm/semibold`, `active:scale-[0.98] transition-transform` (the approved
  motion replacement), focus ring mandatory.
- **Button secondary/outline**: zinc surface, `border` token, secondary text.
- **Input/Textarea/Trigger**: zinc `surface` bg, `border` token, `md` radius,
  `sm` text; focus = `border-ring` + `ring-[3px] ring-ring/50` (shadcn
  default, already violet-correct). Labels: `xs/bold/uppercase/secondary`.
- **Generator prompt input (Raycast bar)**: `surface-elevated` inset,
  `2xl` radius, min-height 130px, kbd-hint chips allowed, NO typewriter
  placeholder (Phase-1 ruling stands).
- **Segmented toggles** (Mode/Originality): keep `layoutId` sliding pill,
  retime to 150ms tween. Platform rail: keep (brand-dot indicator stays).
- **Cards/panels**: solid `surface` + `border` token; hover raises border to
  `brand-soft` max — never glow or blur by default.
- **Sheet/Dialog**: overlay = `overlay` token + `blur-sm`; content uses solid
  `surface-flyout`, `z-modal`, and close `end-4`.
- **Select content**: solid `surface-flyout` bg, check at `end-2`, items `sm`.
- **Skeleton**: `bg-accent` pulse blocks for any list loading.
- **Focus**: every interactive element shows the ring. No exceptions.
- **Navbar**: floating long solid capsule — `sticky top-3` wrapper,
  `max-w-3xl rounded-full border shadow-elevated bg-surface-elevated`,
  symmetric (no physical sides).
- **Opacity modifiers work, with fallback**: `bg-primary/90`-style utilities
  emit a solid fallback declaration plus a `color-mix()` progressive
  enhancement (verified in the built bundle). Both are correct — do not
  "fix" them into arbitrary properties.

## 6. RTL + a11y + ingestion rules
- New code: logical props only; audit fetched code for `left/right/pl-/pr-`
  and convert before merge (`ps/pe/start/end/text-start`).
- `prefers-reduced-motion`: all ambient/entrance animation gated behind it
  (new global rule — currently absent).
- Dialogs/sheets keep Radix focus-trap + Escape; error messages keep
  `role="alert"`; icon buttons keep translated `aria-label`s.
- Fetched components (21st/Magic/Aceternity): adapt to tokens (no raw hex),
  convert `motion/react` imports, cap animations at §2 budget, delete demo
  wrappers. Marquees: forbidden unless direction-neutral.
- Files: marketing blocks → `components/marketing/`; shell (Navbar/Section)
  → `components/layout/` (new); tokens only in `@theme`/`:root`.

## 7. Execution sequence (locked)

1. Shell + tokens (§2 ramp, Navbar, hero reorder, one spotlight, Section
   rhythm, F6 fixes).
2. Marketing surfaces (zinc restyle, Bento strip, Pricing section + Dialog
   variant → Phase-6 hook).
3. Generator polish (command bar, 150ms tweens, flat zinc card) + mobile and
   ultrawide QA. Backend untouched throughout.
