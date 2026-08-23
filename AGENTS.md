# AGENTS.md

## Ground rules (maintainer's priorities — follow these first)

- **Always use the design system.** Never hard-code colors, font sizes, spacing, radii, or shadows. All styling goes through the design tokens in `app/globals.css` (Tailwind v4 `@theme`), consumed as CSS variables:
  ```tsx
  style={{ color: "var(--color-foreground-secondary)", fontSize: "var(--text-sm)", padding: "var(--space-3)" }}
  ```
  Token reference page: `/en/design-system` (dev only; 404s in production). If a needed token doesn't exist, add it to `@theme` instead of inlining raw values.
- **Keep the code simple. Do not over-engineer.** Match existing patterns; don't introduce new abstractions, libraries, wrappers, or config unless the task truly requires it.

## Commands

| Task | Command |
| --- | --- |
| Dev server | `npm run dev` |
| Lint | `npm run lint` |
| Typecheck | `npx tsc --noEmit` (excludes `__tests__/`, `scripts/`, `supabase/`, `lib/ai/`) |
| All unit tests | `npm test` |
| Single test file | `npx tsx --test __tests__/<file>.test.ts` |
| Production build | `npm run build` |

Tests use Node's built-in runner via tsx (`node:test`), not Jest/Vitest.

Prompt/benchmark workflow: `npm run benchmark:baseline` saves a baseline, `benchmark:candidate` compares against it. Bump `PROMPT_VERSION`/`DATASET_VERSION` in `lib/config.ts` only when a candidate is accepted; experiments get a `PROMPT_EXPERIMENT_ID` instead.

## Architecture

- Next.js 16 App Router + React 19. All pages live under `app/[locale]/`; locales are `ar` (default) and `en`, prefix always present (`localePrefix: "always"`).
- Middleware is `proxy.ts` (Next.js 16 renamed `middleware.ts`): runs next-intl routing and sets the `sawwiq_session` cookie; `/api/*` bypasses intl.
- API routes: `app/api/{generate,history,waitlist}`. Validate input with Zod schemas in `lib/validation/`; return errors via `ERROR_CODES` from `types/content`.
- AI pipeline: prompt builders/config live in `lib/content/` (personas, formats, styles), Gemini client in `lib/ai/gemini.ts`.
- Supabase: schema changes go through numbered files in `supabase/migrations/` (`npx supabase db push`). A parallel Edge Function exists in `supabase/functions/generate/`.
- CSP/security headers are defined in `next.config.ts` — new external origins (APIs, fonts, analytics) require updating them.

## Conventions & gotchas

- The app is fully bilingual AR/EN with RTL/LTR support. Use logical CSS properties (`borderInlineStart`, `marginInlineStart`) instead of left/right. LTR-adjusted font tokens exist (`--ltr-text-*`).
- Never hard-code user-facing strings. Add copy to both `messages/ar.json` and `messages/en.json` and access via next-intl.
- Required env vars are documented in `.env.example`. Copy to `.env.local`; note `ANTI_ABUSE_SECRET` is server-side only (no `NEXT_PUBLIC_` prefix).
