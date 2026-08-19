# Sawwiq (سويّق) 🚀

**Sawwiq** is a next-generation SaaS platform designed for AI-powered content generation. Built with modern web technologies, it provides a seamless and responsive user experience for generating high-quality marketing and creative content using Google's advanced Gemini AI.

## ✨ Features

- **🧠 AI Content Generation:** Powered by Google Gemini API (`gemini-2.5-flash-lite` by default) for blazing-fast, high-quality text generation.
- **🔐 Secure Authentication & Backend:** Fully integrated with Supabase for robust user authentication, real-time database, and secure data handling.
- **⚡ Lightning Fast UI:** Built on top of Next.js 16 and React 19, utilizing the App Router for optimal performance and SEO.
- **🎨 Modern Design:** Beautiful, responsive, and accessible interfaces styled with Tailwind CSS v4 and animated using Framer Motion.
- **🛡️ Type-Safe:** End-to-end type safety with TypeScript and Zod schema validation.

## 🛠️ Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
- **Library:** [React 19](https://react.dev/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Backend/BaaS:** [Supabase](https://supabase.com/) (Auth, Postgres DB)
- **AI Provider:** [Google GenAI API](https://ai.google.dev/)
- **Animations:** [Framer Motion](https://www.framer.com/motion/)
- **Forms & Validation:** [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v20 or higher recommended)
- [npm](https://www.npmjs.com/) (or yarn/pnpm)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/sawwiq.git
   cd sawwiq
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Copy the example environment file and fill in your keys:
   ```bash
   cp .env.example .env.local
   ```
   
   Open `.env.local` and add your configurations:
   ```env
   # Google Gemini API
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-2.5-flash-lite

   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application will be available at [http://localhost:3000](http://localhost:3000).

## 📁 Project Structure

- `/app`: Next.js App Router pages and layouts.
- `/components`: Reusable React components (UI and layout).
- `/lib`: Utility functions and shared logic.
- `/supabase`: Supabase database migrations and types.
- `/scripts`: Utility scripts for testing and benchmarking.
- `/__tests__`: Test suites and scenarios.

## 📜 Available Scripts

- `npm run dev`: Starts the Next.js development server.
- `npm run build`: Builds the app for production.
- `npm run start`: Runs the built production application.
- `npm run lint`: Runs ESLint to check for code issues.
- `npm run test`: Executes the test suite using `tsx`.
- `npm run test:scenarios`: Runs specific test scenarios.
- `npm run benchmark`: Runs performance benchmarks.

## ☁️ Deployment

This project is optimized for deployment on [Vercel](https://vercel.com). The project requires setting up the environment variables listed above in the Vercel project settings prior to deployment.

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

*Designed and engineered with passion.*
