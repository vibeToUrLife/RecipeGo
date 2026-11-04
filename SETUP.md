# RecipeGo — Setup Guide

A complete, beginner-friendly walkthrough to get RecipeGo running on your own machine and (optionally) online. No prior experience assumed — every step is copy-paste.

**What you're setting up:** a personal/multi-user recipe app where you save recipes, scale servings, import recipes from a URL, and auto-build an aisle-grouped shopping list that merges duplicate ingredients.

**Tech:** Next.js 16 (App Router) · Supabase (Postgres + Auth + Storage) · Tailwind CSS v4 · TypeScript.

---

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [Get the code & install](#2-get-the-code--install)
3. [Create a Supabase project](#3-create-a-supabase-project)
4. [Configure environment variables](#4-configure-environment-variables-envlocal)
5. [Set up the database](#5-set-up-the-database)
6. [Run the app locally](#6-run-the-app-locally)
7. [Create your account](#7-create-your-account)
8. [Optional: Enable Google sign-in](#8-optional-enable-google-sign-in)
9. [Optional: Deploy online with Vercel](#9-optional-deploy-online-with-vercel)
10. [Shared Rooms](#10-shared-rooms)
11. [Optional: Notifications](#11-optional-notifications)
12. [Useful commands](#12-useful-commands)
13. [Project structure](#13-project-structure)
14. [Troubleshooting](#14-troubleshooting)
15. [Security notes](#15-security-notes)

---

## 1. Prerequisites

Install these once:

| Tool | Why | Get it |
|---|---|---|
| **Node.js 20+** | Runs the app | https://nodejs.org (download the **LTS** version) |
| **A Supabase account** | Database, login, image storage (free tier) | https://supabase.com |
| **A code editor** (optional) | Editing files | https://code.visualstudio.com |
| **A Google account** (optional) | Only if you want "Sign in with Google" | — |
| **A Vercel account** (optional) | Only if you want to put the app online | https://vercel.com |

Check Node is installed — open a terminal (PowerShell on Windows) and run:

```bash
node --version    # should print v20.x or higher
npm --version
```

---

## 2. Get the code & install

If you don't already have the project folder:

```bash
git clone https://github.com/vibeToUrLife/RecipeGo.git
cd RecipeGo
```

Install the dependencies (downloads everything the app needs into `node_modules/`):

```bash
npm install
```

> 💡 If you received the project already set up (with `node_modules/` present), you can skip `npm install`.

---

## 3. Create a Supabase project

1. Go to **https://supabase.com** and sign in.
2. Click **New Project**.
3. Fill in:
   - **Name:** `RecipeGo`
   - **Database Password:** create a strong one and **save it** (you only need it if you use the CLI method in step 5).
   - **Region:** choose the one closest to you.
4. Click **Create new project** and wait ~2 minutes for provisioning to finish.

The site's server code runs in **Tokyo** on Vercel (`hnd1`), next to a database
in Supabase's Tokyo region (`ap-northeast-1`): every page load asks the database
a few things in turn, and each trip across an ocean adds a noticeable wait to
opening the app. If your project is in another region, change both places that
say `hnd1` to the Vercel region nearest it (Vercel's docs list them, under
Regions): `preferredRegion` in `src/app/layout.tsx` (the pages) and `regions` in
`vercel.json` (everything else, including the login check every request passes
first).

Your **project ref** is the random ID in your project URL — e.g. in
`https://abcdxyz123.supabase.co` the ref is `abcdxyz123`. You'll reuse it below.

---

## 4. Configure environment variables (`.env.local`)

The app reads three values from a file called `.env.local` in the project root. This file is **gitignored** — it never gets committed or pushed, so your secrets stay private.

1. Copy the template:

   ```bash
   cp .env.example .env.local
   ```

2. In the Supabase dashboard, go to **⚙️ Project Settings → API Keys** (and **→ API** for the URL). Copy:
   - **Project URL** → `https://<your-project-ref>.supabase.co`
   - **anon / publishable** key (safe for the browser)
   - **service_role / secret** key (server-only — keep private; click *Reveal* to see it)

3. Open `.env.local` and fill it in:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-or-publishable-key>
   # SERVER ONLY — never expose to the browser, never prefix with NEXT_PUBLIC_
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-or-secret-key>
   ```

> ℹ️ Both the legacy keys (`anon` / `service_role`, long `eyJ…` strings) and the newer
> keys (`sb_publishable_…` / `sb_secret_…`) work — use whichever your dashboard shows.

---

## 5. Set up the database

This creates your tables, **Row-Level Security** rules (so each user only ever sees their own data), and the image storage bucket. Pick **one** method.

### Method A — SQL Editor (easiest, no command line) ✅ recommended

1. In the Supabase dashboard, open **SQL Editor → New query**
   (direct: `https://supabase.com/dashboard/project/<your-project-ref>/sql/new`).
2. Open the file **`supabase/setup_all.sql`** from this project, copy **all** of it, and paste it into the editor.
3. Click **Run** (or press `Ctrl/Cmd + Enter`).
4. You should see **"Success. No rows returned."** ✅
   Confirm under **Table Editor** that `recipes`, `ingredients`, `steps`, `tags`,
   `shopping_list_items`, and `profiles` now exist.

### Method B — Supabase CLI (tracks migration history)

Requires logging in once; each command may prompt for input.

```bash
npx supabase login                                   # opens a browser to authorize
npx supabase link --project-ref <your-project-ref>   # asks for your DB password
npx supabase db push                                 # applies all migrations
```

> The CLI applies the individual files in `supabase/migrations/` (the same SQL as `setup_all.sql`).
> Use Method A *or* Method B — not both — on a fresh project.

---

## 6. Run the app locally

```bash
npm run dev
```

You'll see `✓ Ready` and a local address. Open **http://localhost:3000** in your browser.

- Logged-out visitors are redirected to **`/login`** — that's the auth working.
- To stop the server: press `Ctrl + C` in the terminal. To start it again later: `npm run dev`.

---

## 7. Create your account

1. Open **http://localhost:3000** → you'll land on the login page.
2. Enter an **email** and a **password** (at least 6 characters) → click **Sign up**.
3. By default Supabase requires **email confirmation**:
   - You'll see *"Check your email to confirm your account, then log in."*
   - Open your inbox, click the **Confirm your signup** link from Supabase.
   - 📭 No email? Check spam, **or** manually confirm: Supabase → **Authentication → Users** → click your user → **Confirm**.
4. Back at **http://localhost:3000**, **Log in** with the same email + password. You're in! 🎉

> **Want to skip email confirmation** (handy while testing)? Supabase → **Authentication → Sign In / Providers → Email** → turn **Confirm email** off. Turn it back on before sharing the app publicly.

**Try the features:** Add a recipe (＋ Add) or import one from a URL → open it and use the **＋ / –** servings stepper to scale ingredients → **🛒 Add ingredients to shopping list** → add a second recipe and watch duplicates merge by aisle → check items off as you shop.

---

## 8. Optional: Enable Google sign-in

The "Continue with Google" button is already built — this is pure configuration in **two** dashboards. The glue is two redirect URLs:

| Goes in **Google** (Authorized redirect URI) | `https://<your-project-ref>.supabase.co/auth/v1/callback` |
|---|---|
| Goes in **Supabase** (Redirect URLs) | `http://localhost:3000/auth/callback` |

### A. Google Cloud — create credentials

1. Go to **https://console.cloud.google.com** and sign in.
2. Create a project: top bar → **New Project** → name `RecipeGo` → **Create**, then select it.
3. **APIs & Services → OAuth consent screen**:
   - User type **External** → **Create**
   - App name `RecipeGo`, your support email, your developer contact → save
   - Scopes: leave defaults → continue
   - **Test users:** add your own email (while the app is in "Testing", only listed users can sign in)
4. **APIs & Services → Credentials → + Create Credentials → OAuth client ID**:
   - Application type **Web application**, name `RecipeGo Web`
   - **Authorized redirect URIs → + Add URI:** `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - **Create** → copy the **Client ID** and **Client Secret**

### B. Supabase — paste credentials

5. **Authentication → Providers → Google**
   (`https://supabase.com/dashboard/project/<your-project-ref>/auth/providers`):
   enable it, paste the **Client ID** + **Client Secret**, **Save**.

### C. Supabase — allow the redirect back

6. **Authentication → URL Configuration**:
   - **Site URL:** `http://localhost:3000`
   - **Redirect URLs → Add URL:** `http://localhost:3000/auth/callback`
   - **Save**

### D. Test

Go to **/login → Continue with Google**. You'll likely see a *"Google hasn't verified this app"* screen — that's normal for your own app in Testing; click **Advanced → Go to RecipeGo**. To remove that warning later, **Publish** the consent screen (instant for basic email/profile scopes).

---

## 9. Optional: Deploy online with Vercel

Put the app on the internet so you can use it from any device.

1. Push your code to GitHub (already done if you cloned this repo).
2. Go to **https://vercel.com**, sign in with GitHub, click **Add New → Project**, and **import** the `RecipeGo` repo.
3. In the import screen, add the **Environment Variables** (same three as `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Click **Deploy**. After it finishes you'll get a URL like `https://recipego-xxxx.vercel.app`.
5. **Point Supabase at your live URL** — Supabase → **Authentication → URL Configuration**:
   - **Site URL:** `https://<your-app>.vercel.app`
   - **Redirect URLs → Add:** `https://<your-app>.vercel.app/auth/callback`
   - (If you enabled Google, no change is needed in Google Cloud — Google only ever points at Supabase.)

Every future `git push` to the `master` branch auto-deploys.

### Optional: deploy database changes automatically

Vercel deploys the app on every push, but a new migration (a file in `supabase/migrations/`) has to be pasted into the SQL Editor by hand. CI can apply it instead: once lint, tests, build and the database tests have passed on `master`, its **migrate** job applies the migrations the live database doesn't have yet.

1. **Add three secrets:** GitHub → the repository → **Settings → Secrets and variables → Actions → New repository secret**.

   | Name | Value |
   |---|---|
   | `SUPABASE_ACCESS_TOKEN` | Supabase → your avatar (top right) → **Account preferences → Access Tokens → Generate new token** (supabase.com/dashboard/account/tokens) |
   | `SUPABASE_PROJECT_ID` | the project's reference, 20 lowercase letters: the `xxxx` in `https://xxxx.supabase.co` (also **Project Settings → General → Project ID**). Not the project's name. |
   | `SUPABASE_DB_PASSWORD` | the database password chosen when the project was made. Forgotten it? **Project Settings → Database → Reset database password**. The app itself doesn't use it, so nothing else needs changing. |

2. **Baseline once.** A database set up by pasting SQL (Method A) has no record of which migrations it has, so the first run would apply them all again; the migrate job stops with an error instead. Record them once: GitHub → **Actions → Baseline the database → Run workflow**, giving the number of the newest migration the database already has:
   - `20261103120000` if you've pasted the notifications SQL (Supabase → **Table Editor** lists a `push_subscriptions` table);
   - otherwise `20261006120000`, and CI applies the notifications migration for you on the next push.

   Give too old a number and the migrate job fails with "already exists" (nothing is changed): run the baseline again with the newer number.

3. **That's it.** From then on, a push to `master` that adds a migration applies it, a few minutes after Vercel has deployed the app; the app has to cope with those few minutes, as it does now for new tables and columns. Until the secrets are set, the migrate job only notes that it did nothing.

### Optional: deploy the site after the database

With migrations deploying from CI, Vercel still puts new code live the moment you push, a couple of minutes before its migration lands: long enough for someone to open a page that needs a table that isn't there yet. CI can deploy the site instead, once **migrate** has finished, and only if everything before it passed.

1. **Add three more secrets** (GitHub → **Settings → Secrets and variables → Actions**):

   | Name | Value |
   |---|---|
   | `VERCEL_TOKEN` | Vercel → your avatar → **Account Settings → Tokens → Create**: name it something like "GitHub Actions", for the account or team the project is in |
   | `VERCEL_PROJECT_ID` | Vercel → the project → **Settings → General → Project ID** (starts `prj_`) |
   | `VERCEL_ORG_ID` | the ID of the account or team the project is in: its **Settings → General** (a team's starts `team_`) |

2. **Push to `master`** and check, in Actions, that the **deploy** job goes green with a "Production" address in its log. Until step 3, Vercel also deploys on its own, so each push goes out twice, which does no harm.

3. **Turn off Vercel's own deploy for `master`**, so it only goes live from CI: that's the repository's `vercel.json`, `{ "git": { "deploymentEnabled": { "master": false } } }`, already in place. Other branches still get their preview deployments. (Without the three secrets, nothing deploys `master` at all: either set them, or take the `git` part out of `vercel.json` to go back to Vercel's deploy on push. Keep its `regions`.)

Then the old code keeps running for a minute or so after a migration lands, until the new code is live. So a migration should only add (tables, columns, policies), which the old code runs fine with; removing or renaming something waits for a later release, once nothing uses it.

---

## 10. Shared Rooms

Shared Rooms let multiple users add, edit, and delete the same recipes and share one shopping list.

### Apply the Rooms migration

The Rooms tables and RLS policies are included in `supabase/setup_all.sql`, so **if you ran Method A or B in step 5 on a fresh project they are already applied.**

If you added Rooms to an existing project (i.e., the DB was set up before the Rooms feature was merged), apply the migration manually:

1. Open **SQL Editor → New query** in your Supabase dashboard.
2. Open `supabase/migrations/20260628220000_rooms.sql`, copy **all** of it, paste, and click **Run**.
3. You should see **"Success. No rows returned."** ✅

Alternatively, drop and recreate the entire schema by re-running `supabase/setup_all.sql` on a fresh project.

### How rooms work

| Step | What happens |
|---|---|
| **Create a room** | Open the **Rooms** page (`/rooms`) → **New room**. You become the owner and are automatically added as a member. |
| **Invite others** | Inside the room → **Members** → **Invite by email**. The invitee receives a pending invite (only owners can invite). |
| **Accept an invite** | The invitee opens `/rooms` and clicks **Accept** next to the pending invite. They are added as a member immediately. |
| **Add recipes** | Any member can create, edit, and delete recipes inside the room. Switch context using the room picker at the top of the recipes page. |
| **Shared shopping list** | Each room has its own shopping list. Add ingredients from any room recipe and all members see the same list. |
| **Personal recipes stay private** | Recipes without a `room_id` are only visible to their creator — Rooms do not affect personal data. |
| **Leave or remove members** | Members can leave a room themselves; only the owner can remove other members or delete the room. |

> **Outsider isolation** is enforced by Row-Level Security at the database level. A user who is not a room member cannot read or write that room's recipes, ingredients, steps, shopping list items, members list, or invites — regardless of how they call the API.

---

## 11. Optional: Notifications

Members of a room can get a notification on their phone when someone else changes the room's meal plan or shopping list: adds items, finishes the shop, plans, moves or removes a meal, or copies last week. Each person turns them on for each phone, on the **Rooms** page or a room's **Members** page.

### A. Apply the migration

A project set up with `setup_all.sql` after notifications were added already has it. Otherwise open **SQL Editor → New query**, paste all of `supabase/migrations/20261103120000_push_notifications.sql`, and click **Run**.

### B. Make a VAPID key pair

Push services (Apple's, Google's, Mozilla's) check every notification against this key pair. On your computer, run:

```bash
npx web-push generate-vapid-keys
```

It prints a **Public Key** and a **Private Key**. Keep the private key secret, like a password.

### C. Add them to Vercel

Vercel → your project → **Settings → Environment Variables**:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | the public key |
| `VAPID_PRIVATE_KEY` | the private key |
| `SUPABASE_SERVICE_ROLE_KEY` | if it isn't there already: Supabase → **Project Settings → API Keys** → service_role / secret |
| `VAPID_SUBJECT` | optional: `mailto:you@example.com`, who push services can contact. Without it, the site's own address is used. |

Then **redeploy** (Deployments → ⋯ → **Redeploy**): the public key is built into the app, so a build from before it was added doesn't have it. Until all of these are set, the Notifications card stays hidden and nothing is sent.

### D. Turn them on

- **iPhone or iPad (iOS 16.4 or later):** notifications only work in RecipeGo added to the Home Screen. In Safari or Chrome: **Share → Add to Home Screen**. Open RecipeGo from the Home Screen, go to **Rooms**, tap **Turn on notifications**, and allow them.
- **Android or a computer:** open **Rooms** and tap **Turn on notifications**.

Tap **Send a test** to check one arrives.

A run of changes notifies once. Each kind of change (adding to the list, finishing the shop, changing the plan) sends the others at most one notification every five minutes per person and room, counted from the last one sent, whichever page or phone the change came from. Ticking or editing items, and changes to your own (not a room's) list or plan, notify no one. Signing out on a phone turns its notifications off.

---

## 12. Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the local dev server (http://localhost:3000) |
| `npm run build` | Production build (type-checks the whole app) |
| `npm run start` | Run the production build locally |
| `npm run lint` | Lint the code |
| `npm run test:run` | Run the unit-test suite once |
| `npm test` | Run tests in watch mode |

---

## 13. Project structure

```
src/
  app/                     # Pages & routes (App Router)
    login/                 # Login/signup page + server actions + Google OAuth
    recipes/               # Recipe list, detail, new, edit
    shopping-list/         # Shopping list page + actions
    api/import-recipe/     # URL import endpoint (SSRF-guarded)
    auth/callback/         # OAuth/email-confirm code exchange
    icon.svg               # Browser-tab favicon
  components/              # UI components (recipe form, cards, nav, shadcn/ui)
  lib/                     # Pure logic: units, scaling, merge, aisles, recipe parsing
    data/                  # Server-only data access (recipes, shopping)
  utils/supabase/          # Supabase clients (browser, server, admin) + session refresh
  proxy.ts                 # Route protection (redirects logged-out users to /login)
supabase/
  migrations/              # Individual SQL migrations
  setup_all.sql            # All migrations combined (for the SQL Editor method)
.env.local                 # Your secrets (gitignored — never committed)
```

---

## 14. Troubleshooting

**"Your project's URL and Key are required" / app won't start**
`.env.local` is missing or misspelled. Confirm the three variable names exactly match step 4, then restart `npm run dev` (env changes need a restart).

**Login/signup button seems to do nothing**
Make sure you're on the latest code (`git pull`). Check the terminal running `npm run dev` for an error. If signup succeeded but you can't log in, you probably still need to **confirm your email** (step 7).

**Redirected to `/login` over and over**
That's expected when logged out. If it happens *after* logging in, your Supabase keys in `.env.local` may be wrong, or the database isn't set up (step 5).

**Google sign-in: "redirect_uri_mismatch"**
The Authorized redirect URI in Google must be **exactly** `https://<your-project-ref>.supabase.co/auth/v1/callback` (no trailing slash, correct project ref).

**Google sign-in: "Access blocked / app not verified"**
Add your email as a **Test user** on the consent screen, or **Publish** the consent screen.

**Confirmation email never arrives**
Check spam, or confirm the user manually under **Authentication → Users**. The free tier also has an hourly email limit.

**Image upload fails**
The message on the toast says which limit you hit:

| Message | Cause | Fix |
|---|---|---|
| *Image storage isn't set up yet* | The bucket/policies were never created | Open **SQL Editor → New query**, paste the `-- ========== 5. IMAGE STORAGE ==========` section of `supabase/setup_all.sql`, and **Run**. That block is safe to re-run on a database that already has part of it. |
| *That image is over 5 MB* | The bucket caps each object at 5 MiB | Shrink or re-export the photo. To raise the cap, change `file_size_limit` in that same section **and** `MAX_BYTES` in `src/components/image-upload.tsx`. |
| *Please choose a JPEG, PNG, or WebP image* | The bucket only allows those three types — HEIC (iPhone), GIF, and SVG are refused | Convert the photo, or add the type to both `allowed_mime_types` in that section and `MIME_EXT`/`EXT_MIME` in `src/components/image-upload.tsx`. |
| *Storage refused the upload* | Signed out, or the `recipe-images` policies are missing | Sign out and back in; if that doesn't help, re-run the section above. |
| *Upload failed* | The request never reached Supabase | Check your connection and that `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` match your project. The browser console has the underlying error. |

**"Something went wrong" when you add a recipe to the plan**
Your database is missing the meal-planner table (`meal_plan_entries`), or the `note` column on it. Earlier copies of `setup_all.sql` left that section out, so projects set up with Method A never got it. Fix: open **SQL Editor → New query**, paste the `-- 4c. MEAL PLANNER` section of `supabase/setup_all.sql`, and click **Run**. That block is safe to run on a database that already has some of it.

**"Could not update your plan" when you tick a meal as eaten (✓)**
Your database is missing the `eaten_at` column on `meal_plan_entries`, which came with the ✓ button (`20261006120000_meal_plan_eaten.sql`). The rest of the plan keeps working without it. Fix: `npx supabase db push` (Method B), or re-run the `-- 4c. MEAL PLANNER` section of `supabase/setup_all.sql` as above.

**Port 3000 already in use**
Another process is using it. Stop it, or run on another port: `npm run dev -- -p 3001`.

**Imported recipe has no quantities**
The app parses common formats (`200g flour`, `1/2 cup sugar`). Unusual lines may import as plain text — just edit the quantity/unit fields before saving.

---

## 15. Security notes

- **`SUPABASE_SERVICE_ROLE_KEY` is all-powerful** — it bypasses every security rule. It is used **server-side only**, is never sent to the browser, and must never be prefixed with `NEXT_PUBLIC_`. If it ever leaks, rotate it in **Project Settings → API Keys**. The app uses it for notifications alone: to save each phone's subscription (after checking it's a real push service's address) and to read the other members' when telling them about a change, which RLS keeps from everyone but their owner.
- **`VAPID_PRIVATE_KEY`** signs every notification. Keep it secret like a password; if it leaks, make a new pair (section 11), and everyone turns notifications on again.
- **Row-Level Security (RLS)** is the real boundary: every table has policies so each signed-in user can only read/write their **own** rows. The `anon`/publishable key is safe to expose in the browser precisely because RLS restricts what it can do.
- **`.env.local` is gitignored** — keep it that way; never commit real keys.
- The URL-import endpoint blocks requests to localhost/private/cloud-metadata addresses to prevent SSRF.
