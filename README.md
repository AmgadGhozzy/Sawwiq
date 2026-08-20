# Sawwiq (سويّق) 🚀

<p align="center">
  <img src="public/logo.png" alt="Sawwiq Logo" width="120" />
</p>

<p align="center">
  <strong>AI-Powered Marketing Content Generator</strong><br/>
  Generate high-quality, platform-specific marketing content in Arabic & English — powered by Google Gemini.
</p>

<p align="center">
  <a href="https://sawwiq.com">Live Demo</a> •
  <a href="#-features">Features</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-getting-started">Getting Started</a>
</p>

---

## ✨ Features

- **🧠 AI Content Generation** — Powered by Google Gemini API (`gemini-2.5-flash-lite`) for blazing-fast, high-quality marketing copy tailored to each social platform.
- **🌍 Bilingual (AR / EN)** — Full RTL/LTR support with `next-intl`. Switch languages seamlessly at runtime.
- **📱 Platform-Aware** — Generates content optimized for Instagram, X (Twitter), Facebook, TikTok, LinkedIn, and more — complete with hashtags and engagement hooks.
- **📜 Generation History** — Browse, copy, and revisit your past generations with a beautiful slide-out drawer.
- **🔐 Supabase Backend** — Secure authentication, Postgres database, Row-Level Security, and Edge Functions.
- **🛡️ Anti-Abuse System** — HMAC-SHA256 browser fingerprinting + rate limiting to prevent API misuse.
- **📊 Vercel Analytics** — Integrated performance and usage analytics out of the box.
- **⚡ Lightning Fast** — Built on Next.js 16 (App Router) and React 19 for optimal performance and SEO.
- **🎨 Premium Design** — Dark glassmorphic UI with Framer Motion animations, responsive on all devices.
- **🛡️ Type-Safe** — End-to-end type safety with TypeScript and Zod schema validation.
- **🔍 SEO Optimized** — Dynamic OG images, structured data (JSON-LD), sitemap, and robots.txt.

## 🛠️ Tech Stack

| Category             | Technology                                                        |
| -------------------- | ----------------------------------------------------------------- |
| **Framework**        | [Next.js 16](https://nextjs.org/) (App Router)                    |
| **Library**          | [React 19](https://react.dev/)                                    |
| **Styling**          | [Tailwind CSS v4](https://tailwindcss.com/)                       |
| **Backend / BaaS**   | [Supabase](https://supabase.com/) (Auth, Postgres, Edge Funcs)    |
| **AI Provider**      | [Google GenAI SDK](https://ai.google.dev/)                        |
| **i18n**             | [next-intl](https://next-intl.dev/)                               |
| **Animations**       | [Framer Motion](https://www.framer.com/motion/)                   |
| **Forms**            | [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) |
| **Icons**            | [Lucide React](https://lucide.dev/)                               |
| **Fingerprinting**   | [FingerprintJS](https://fingerprint.com/)                         |
| **Analytics**        | [Vercel Analytics](https://vercel.com/analytics)                  |
| **Language**         | [TypeScript 5](https://www.typescriptlang.org/)                   |

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v20 or higher
- [npm](https://www.npmjs.com/) (or yarn / pnpm)
- A [Supabase](https://supabase.com/) project
- A [Google AI API key](https://ai.google.dev/)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/AmgadGhozzy/Sawwiq.git
   cd Sawwiq
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```

   Fill in your keys in `.env.local`:
   ```env
   # ── AI Provider ───────────────────────────────────────────
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-2.5-flash-lite          # optional override

   # ── Supabase ──────────────────────────────────────────────
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

   # ── Anti-Abuse ────────────────────────────────────────────
   ANTI_ABUSE_SECRET=your-anti-abuse-secret-here
   ```

4. **Run the Supabase migrations** (if applicable):
   ```bash
   npx supabase db push
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the app.

## 📁 Project Structure

```
Sawwiq/
├── app/
│   ├── [locale]/          # i18n-aware pages (AR/EN)
│   │   ├── layout.tsx     # Root layout with metadata & fonts
│   │   ├── page.tsx       # Home page
│   │   ├── error.tsx      # Error boundary
│   │   ├── loading.tsx    # Loading skeleton
│   │   └── not-found.tsx  # 404 page
│   ├── api/               # API routes
│   │   ├── generate/      # AI content generation endpoint
│   │   ├── history/       # Generation history endpoint
│   │   └── waitlist/      # Waitlist signup endpoint
│   ├── globals.css        # Global styles & Tailwind imports
│   ├── sitemap.ts         # Dynamic sitemap generation
│   └── robots.ts          # Robots.txt configuration
├── components/
│   ├── contact/           # Footer & contact drawer
│   ├── generator/         # Content generator UI (input, settings, results)
│   ├── history/           # Generation history drawer & cards
│   ├── marketing/         # CTA and conversion components
│   ├── seo/               # JSON-LD structured data
│   └── ui/                # Shared UI (language switcher, icons)
├── hooks/                 # Custom React hooks (fingerprinting)
├── i18n/                  # next-intl routing & request config
├── lib/
│   ├── ai/                # Gemini prompt builders & API client
│   ├── analytics/         # Analytics utilities
│   ├── evaluation/        # Content quality evaluation
│   ├── supabase/          # Supabase client & helpers
│   ├── utils/             # Shared utility functions
│   └── validation/        # Zod schemas & validation logic
├── messages/              # i18n translation files (ar.json, en.json)
├── public/                # Static assets (logo, OG image)
├── scripts/               # Benchmarks & test scenario runners
├── supabase/              # Database migrations & Edge Functions
├── types/                 # Shared TypeScript type definitions
└── __tests__/             # Unit & integration test suites
```

## 📜 Available Scripts

| Command                   | Description                              |
| ------------------------- | ---------------------------------------- |
| `npm run dev`             | Start the Next.js dev server             |
| `npm run build`           | Build the production bundle              |
| `npm run start`           | Serve the production build               |
| `npm run lint`            | Run ESLint checks                        |
| `npm run test`            | Execute all unit tests                   |
| `npm run test:scenarios`  | Run integration test scenarios           |
| `npm run benchmark`       | Run performance benchmarks               |

## ☁️ Deployment

This project is optimized for **[Vercel](https://vercel.com)**:

1. Import the repo at [vercel.com/new](https://vercel.com/new).
2. Add all environment variables from `.env.example` in the project settings.
3. Deploy — Vercel auto-detects Next.js and handles the rest.

See the [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying) for more options.

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

1. Fork the repository
2. Create your branch: `git checkout -b feat/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push to the branch: `git push origin feat/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is proprietary. All rights reserved.

---

<p align="center">
  Designed and engineered with ❤️ by <a href="https://github.com/AmgadGhozzy">Amgad Ghozzy</a>
</p>
