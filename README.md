# RecipeGo

## What it is

RecipeGo is a multi-user recipe management app where every cook has their own private library. You can add recipes by hand or import them directly from any food blog URL — the app fetches the page, parses the ingredients and steps, and pre-fills the form so you only need to review and save. A built-in serving scaler adjusts every quantity when you change the number of portions. When you add recipes to your shopping list, RecipeGo merges shared ingredients across dishes (so two recipes each calling for garlic appear as one line with the combined amount) and groups everything by supermarket aisle so you can move through the store in order. The interface follows a Warm Editorial design — clean typography, a cream-and-terracotta palette, and no visual clutter.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript, `src/` directory) |
| Auth & Database | Supabase — Postgres, Row-Level Security, Supabase Auth, Supabase Storage |
| Auth adapter | `@supabase/ssr` (cookie-based sessions, works in Server Components and Route Handlers) |
| Styling | Tailwind CSS v4 (CSS-first config — no `tailwind.config.js`) + shadcn/ui |
| URL import | `cheerio` for server-side HTML parsing in `/api/import-recipe` |
| Request interceptor | `src/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`) |
| Tests | Vitest (unit + route handler tests); `supabase test db` for pgTAP RLS tests |
| DB migrations | Four SQL files in `supabase/migrations/` — profiles, recipes, shopping list, storage |

---

## Prerequisites

- **Node.js 20 or later** — [nodejs.org](https://nodejs.org)
- **A free Supabase project** — [supabase.com](https://supabase.com). The free tier is sufficient for local development and small deployments.
- **Docker Desktop** _(optional)_ — only required if you want to run the pgTAP database-level RLS tests locally with `npm run test:db`. Not needed for regular development or deployment.

---

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file:

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in the three values. You find all three in your Supabase dashboard under **Project Settings → API**:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | "Project URL" — looks like `https://abcdefghijklm.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | "anon / public" key under "Project API keys" |
| `SUPABASE_SERVICE_ROLE_KEY` | "service_role / secret" key under "Project API keys" |

> **Security note:** `SUPABASE_SERVICE_ROLE_KEY` bypasses Row-Level Security. Never expose it to the browser and never prefix it with `NEXT_PUBLIC_`. It is used only in server-side Route Handlers.

### 3. Link your Supabase project and apply migrations

The database schema lives in four migration files under `supabase/migrations/`. Apply them to your hosted Supabase project:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Your project ref is the subdomain part of your Supabase URL — if your URL is `https://abcdefghijklm.supabase.co`, the ref is `abcdefghijklm`.

`npx supabase db push` applies all four migrations in order (profiles, recipes, shopping list, storage bucket and RLS policies). You only need to run this once per environment, or again when new migrations are added.

### 4. Start the development server

```bash
npm run dev
```

The app is now available at [http://localhost:3000](http://localhost:3000).

---

## Enable Google sign-in

Google OAuth is optional — the app also supports email/password sign-in. To add Google:

1. **Create OAuth credentials in Google Cloud Console.**
   - Go to [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → Create credentials → OAuth 2.0 Client ID.
   - Application type: Web application.
   - Authorised redirect URIs: add `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback`.
   - Note the **Client ID** and **Client Secret**.

2. **Enable Google in the Supabase dashboard.**
   - Go to **Authentication → Providers → Google**.
   - Toggle Google on, paste your Client ID and Client Secret, and save.

3. **Configure the allowed redirect URLs.**
   - Go to **Authentication → URL Configuration**.
   - Under **Redirect URLs**, add:
     - `http://localhost:3000/auth/callback` (for local development)
     - `https://<your-production-domain>/auth/callback` (for the deployed app)
   - Set the **Site URL** to your production domain (e.g. `https://recipego.vercel.app`).

---

## Email confirmations

By default, Supabase sends a confirmation email on sign-up. The confirmation link routes through `/auth/callback`, which exchanges the token for a session and redirects the user into the app.

If you want to skip this step during local development, you can disable confirmations in **Authentication → Email** in the Supabase dashboard (toggle off "Confirm email"). Re-enable it before deploying to production.

---

## Tests

### Logic and route handler tests (Vitest)

```bash
npm run test:run
```

This runs 41 tests covering business logic (serving scaler, aisle grouping, ingredient merging, unit conversion) and the URL import route handler. No network or database connection is required.

### Database RLS tests (pgTAP)

```bash
npm run test:db
```

This runs pgTAP tests that verify Row-Level Security policies at the Postgres level. It requires:
- **Docker Desktop** running
- A local Supabase instance started first: `npx supabase start` (first run pulls Docker images, which takes a few minutes)

The RLS tests are provided for local verification when Docker is available and have not yet been run in CI.

---

## Deploy to Vercel

### 1. Push to GitHub

Commit your code and push to a GitHub repository.

### 2. Import into Vercel

- Go to [vercel.com](https://vercel.com) → Add New → Project → import your GitHub repository.
- Vercel detects Next.js automatically — no build settings need changing.

### 3. Set environment variables

In the Vercel project settings under **Environment Variables**, add all three variables from `.env.example`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Use the same values as your `.env.local`.

### 4. Deploy

Click **Deploy**. Vercel builds the app and assigns a domain like `https://recipego.vercel.app`.

### 5. Update Supabase redirect allowlist

After the deploy, go back to the Supabase dashboard → **Authentication → URL Configuration**:

- Add `https://<your-vercel-domain>/auth/callback` to the Redirect URLs list.
- Update the **Site URL** to `https://<your-vercel-domain>`.

If you are using a custom domain, substitute that for the Vercel-assigned domain.

---

## End-to-end smoke checklist

Run through this checklist after your first deployment (or after any migration change) to confirm everything is wired together correctly.

- [ ] **Sign up** with a new email address. After clicking the confirmation link you are redirected to the home page and a row appears in the `profiles` table in your Supabase dashboard.
- [ ] **Add a recipe manually.** Click "New Recipe", fill in title, ingredients, and steps, save → the recipe appears in your library. Click it to open the detail page.
- [ ] **Import a recipe from a URL.** Click "Import from URL", paste a link from a popular food blog (e.g. seriouseats.com or budgetbytes.com), click Import → the form is pre-filled with the parsed ingredients and steps. Review and save.
- [ ] **Scale servings.** Open any recipe and change the serving count → all ingredient quantities update proportionally.
- [ ] **Shopping list merging and aisle grouping.** Add two recipes that share a common ingredient (e.g. both call for garlic) to the shopping list. The list shows a single garlic line with the combined quantity, and all ingredients are grouped by supermarket aisle.
- [ ] **Check and clear.** Check off individual items on the shopping list → the progress bar advances. Click "Clear checked" → checked items are removed.
- [ ] **Sign out.** Click sign out → you are redirected to `/login`. Navigating to a protected page (e.g. `/recipes`) while signed out also redirects to `/login`.

---

## Project structure (quick reference)

```
src/
  app/           Next.js App Router pages and Route Handlers
  components/    Shared UI components
  lib/           Business logic (aisle grouping, unit conversion, serving scaler)
  proxy.ts       Next.js 16 request interceptor (session refresh + auth redirects)
supabase/
  migrations/    Four SQL migration files applied with `npx supabase db push`
  tests/         pgTAP RLS test files
```
