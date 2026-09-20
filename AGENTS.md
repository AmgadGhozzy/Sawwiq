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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- graft:start -->
## Graft — repo context graph

This repo is indexed in `graft/`: small linked markdown nodes that explain each
system and carry exact file:line spans, kept in sync with the code through git.

For ANY task here — understanding how something works, finding where code lives,
or scoping a change — get context from the graph before grepping or opening
source files. Re-ask freely (it's cheap) and reuse literal identifiers you
already have (symbol, error string, file name) as the query. New to this repo?
Run `graft map` first — a token-budgeted orientation (dir clusters, hubs,
hotspots), no LLM, no key.

- Run `graft ask "<your question>" --source` → ranked nodes with the relevant
  code spans inlined (each hit's ≤8-line crux by default; `--full` for whole
  definitions when the crux isn't enough). Match the tool to the task shape:
  for understanding or editing, the top node IS the answer — cite its
  `covers:` file:line spans and edit straight from `--source`. For
  exhaustive tasks ("every occurrence / every caller of this pattern"), ranked
  results are top-N, not complete — run `graft grep "<literal>"` instead
  (exhaustive over indexed files, grouped by enclosing symbol), falling back
  to raw `grep -rn` only for unindexed files.
- `graft skeleton <file>` → every definition's signature + span, ~10× cheaper
  than reading the file; use it to skim an API surface.
- `graft callers <symbol>` gives precomputed, exact edges — who calls this.
  Add `--direction out` for what it calls, or `--depth N` to walk
  transitively for the full blast radius. For structural questions, skip
  ranking and use this directly.
- Or browse: `graft/INDEX.md` lists every node; follow the links.
- Monorepos and folders of multiple repos rank fairly across sub-projects —
  hits carry `[scope/]` labels naming which one they're from. Narrow with
  `graft ask "<task>" --in <scope>/` once you know where you're working.

If a returned span is truncated ("+N more lines"), open the file at that exact
range before finalizing. Only open source files when a node genuinely lacks a
needed detail, and then at the exact file:line the node points to — never
re-read whole files.

After big code changes, refresh the graph with `graft build` (deterministic,
no API key, $0).
<!-- graft:end -->
