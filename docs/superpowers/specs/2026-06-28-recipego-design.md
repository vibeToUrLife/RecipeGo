# RecipeGo — Design Specification

**Date:** 2026-06-28
**Status:** Approved (design), pending spec review
**Author:** Drafted with Claude Code via brainstorming

---

## 1. Overview

RecipeGo is a multi-user web application for saving recipes and generating intelligent
"what to buy" shopping checklists. Any visitor can create an account; each user has a
private collection of recipes. From any set of selected recipes the app builds a single,
deduplicated, aisle-grouped shopping list.

**Design goals**

- Genuinely convenient and "intelligent" using pure application logic — **no paid AI required**.
- Polished, appetizing UI in a single confirmed visual language ("Warm Editorial").
- **$0 running cost** on free tiers, able to scale to many users.
- Architected so optional AI features can be added later with no rework.

**Primary user story**

> As a logged-in user, I save my recipes, pick the ones I want to cook this week, and get one
> shopping checklist — duplicates merged, quantities summed, organized by grocery aisle — that
> I tick off while shopping on my phone.

---

## 2. Confirmed product decisions

| Decision | Choice | Status |
|---|---|---|
| Scope | Public, multi-user app with private per-user data | confirmed |
| Feature set | Free core only (accounts, recipes, auto shopping list, URL import); AI deferred | confirmed |
| Visual style | Warm Editorial — cream background, terracotta + sage accents, serif headings | confirmed |
| Home layout | Top navigation + hero banner, responsive recipe grid | confirmed |
| Recipe detail | Two-column (ingredients beside method), servings stepper, "Add to shopping list" CTA | confirmed |
| Shopping list grouping | By grocery aisle (Produce, Dairy, Pantry, Meat, …) | confirmed |
| Auth | Email/password + Google sign-in | confirmed |
| Recipe photos | Optional per recipe; emoji/gradient fallback when absent | confirmed |

---

## 3. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router) | Frontend + backend route handlers in one codebase |
| Language | TypeScript | Strict mode |
| UI | Tailwind CSS + shadcn/ui | Themed to Warm Editorial design tokens |
| Database | Supabase PostgreSQL | Free tier |
| Auth | Supabase Auth | Email/password + Google OAuth |
| Storage | Supabase Storage | Recipe images bucket (optional uploads) |
| Authorization | PostgreSQL Row-Level Security (RLS) | Every table scoped to `auth.uid()` |
| Hosting | Vercel (app) + Supabase (data) | Both free tier |

**Why this stack:** fewest moving parts for a secure multi-user app, single deployable codebase,
managed auth/DB/storage on a free tier, and trivial later integration of an AI endpoint via a
Next.js route handler.

---

## 4. Visual design language (Warm Editorial)

- **Palette:** terracotta `#b5532a` (primary), warm orange `#d98b56`, sage `#7a8b4a`,
  cream `#fbf6ee` (background), deep brown `#3a2e22` (text).
- **Type:** serif for headings/recipe titles (e.g. a Georgia-like serif), clean sans-serif
  (system UI) for metadata, controls, and body.
- **Shape & feel:** rounded cards (12–18px), soft warm shadows, generous spacing, appetizing
  gradient placeholders where photos are absent.
- Encoded as Tailwind theme tokens and a shadcn/ui theme so it is applied consistently.

---

## 5. Screens & routes

| Route | Screen | Purpose |
|---|---|---|
| `/login`, `/signup` | Auth | Email/password + Google; redirect to home when signed in |
| `/` | Home / Library | Hero banner, search, tag filters, responsive recipe grid |
| `/recipes/new` | Add recipe | Manual form **or** "Import from URL" |
| `/recipes/[id]` | Recipe detail | Two-column ingredients/method, servings stepper, Add-to-list |
| `/recipes/[id]/edit` | Edit recipe | Same form as add, pre-filled |
| `/shopping-list` | Shopping list | Merged, aisle-grouped checklist with progress + recipe chips |
| `/settings` | Settings | Profile, sign out |

All routes except `/login` and `/signup` require an authenticated session (middleware redirect).

---

## 6. Data model (PostgreSQL)

All user-owned tables carry `user_id uuid references auth.users` and are protected by RLS so a
user can only read/write their own rows.

**profiles**
- `id uuid pk` (= auth user id), `display_name text`, `avatar_url text`, `created_at timestamptz`

**recipes**
- `id uuid pk`, `user_id uuid`, `title text`, `description text`, `image_url text null`,
  `servings int default 1`, `prep_minutes int null`, `cook_minutes int null`,
  `difficulty text null` (easy/medium/hard), `source_url text null`,
  `created_at timestamptz`, `updated_at timestamptz`

**ingredients**
- `id uuid pk`, `recipe_id uuid`, `name text`, `quantity numeric null`, `unit text null`,
  `category text` (grocery aisle; defaults via auto-categorization), `position int`

**steps**
- `id uuid pk`, `recipe_id uuid`, `step_number int`, `text text`

**tags**
- `id uuid pk`, `user_id uuid`, `name text`

**recipe_tags**
- `recipe_id uuid`, `tag_id uuid` (composite pk)

**shopping_list_items**
- `id uuid pk`, `user_id uuid`, `name text`, `total_quantity numeric null`, `unit text null`,
  `category text`, `checked boolean default false`, `source_recipe_ids uuid[]`,
  `created_at timestamptz`

A user has one implicit active shopping list (the set of their `shopping_list_items`). Selecting
recipes adds/merges items into it; items persist until checked-and-cleared or removed.

---

## 7. Intelligent logic (pure code, no AI)

### 7.1 Ingredient merging
When ingredients are added to the shopping list, items are merged by normalized name + compatible
unit. Quantities are summed. Example: garlic from two recipes (4 + 6 cloves) → "Garlic, 10 cloves,
merged ×2", with `source_recipe_ids` tracking origins.

### 7.2 Unit handling
A small unit-conversion module normalizes within compatible families before summing:
- volume: tsp ↔ tbsp ↔ cup ↔ ml ↔ l
- mass: g ↔ kg ↔ oz ↔ lb
- count/each: pieces, cloves, etc. (no conversion, summed when units match)

Incompatible or unitless items are listed separately rather than force-merged.

### 7.3 Aisle auto-categorization
A built-in lookup table maps common ingredient names → grocery aisle (Produce, Dairy & Eggs,
Meat & Seafood, Pantry, Bakery, Frozen, Spices, Other). Applied when ingredients are created and
when items land on the shopping list. Users can override any item's aisle; unknown items default
to "Other".

### 7.4 Serving scaler
On the recipe detail page, changing servings recomputes all displayed quantities by the ratio
`newServings / baseServings`. The scaled quantities are what get added to the shopping list.

### 7.5 URL import
`/recipes/new` accepts a URL. A server route handler fetches the page and parses
schema.org/Recipe structured data (JSON-LD / microdata) to extract title, image, servings,
times, ingredients, and steps, then pre-fills the editable form. If no structured data is found,
the user is told to enter the recipe manually (clean fallback, no crash). Parsing runs
server-side to avoid CORS and to keep keys/logic off the client.

---

## 8. Authentication & security

- Supabase Auth handles signup, login, sessions, and Google OAuth.
- Session enforced via Next.js middleware; unauthenticated users are redirected to `/login`.
- **Row-Level Security on every user table** is the real security boundary: policies restrict
  `select/insert/update/delete` to rows where `user_id = auth.uid()`.
- Server route handlers use the user's session; no service-role key is exposed to the client.
- Storage bucket policies restrict image upload/read to the owning user (or public-read for images
  if simpler, decided at implementation — default to owner-scoped).

---

## 9. UX & convenience details

- Optimistic UI for checkbox toggles and list edits (instant feel, reconciled with server).
- Shopping list persists across devices (server-backed) so the phone in the store matches the desktop.
- Search-as-you-type and tag filters on the library.
- Mobile-first responsive: top nav collapses appropriately; recipe detail stacks to one column on
  small screens; shopping list is thumb-friendly.
- Thoughtful empty states (no recipes yet → prompt to add or import; empty list → prompt to pick recipes).
- Recipe images optional; appetizing gradient + emoji fallback keeps the grid attractive without uploads.

---

## 10. AI extension points (deferred, not built in v1)

Designed as clean server-side slots so they add later with no rework:

- **Photo → recipe import:** a route handler that accepts an image and returns structured recipe
  fields (vision model). Slots beside the existing URL-import flow.
- **"What can I cook with X":** a route handler taking on-hand ingredients → suggested recipes.
- **Recipe suggestions/generation:** a route handler producing recipe drafts.

Each is an isolated endpoint behind a feature flag; the core app never depends on them. Cost only
incurred if/when enabled.

---

## 11. Out of scope for v1 (YAGNI)

Meal-planner calendar, pantry/inventory tracking, social feed or public recipe sharing,
cross-user ratings/comments, nutrition analysis. The data model leaves room to add these later.

---

## 12. Testing strategy

- **Unit tests** for the pure logic that carries the product value: unit conversion, ingredient
  merging, serving scaling, aisle categorization, and schema.org parsing (with sample fixtures).
- **Integration tests** for route handlers (URL import, list building) and RLS policy behavior
  (a user cannot read another user's rows).
- **Component/UI smoke tests** for the key screens (library, recipe detail, shopping list).
- Manual/responsive QA pass on mobile and desktop against the confirmed mockups.

---

## 13. Deployment

- **Supabase project:** schema via SQL migrations, RLS policies, storage bucket, Google OAuth
  provider configured.
- **Vercel project:** Next.js app, environment variables for Supabase URL + anon key (and
  server-only keys as needed). Auto-deploy from the repo.
- **Environment variables** documented in a `.env.example`.
- Local dev runs against the hosted Supabase project (or Supabase local stack) — decided at plan time.

---

## 14. Definition of done (v1)

A deployed app where a user can: sign up / log in (email or Google); add a recipe manually or by
URL import; view/edit/delete recipes in a searchable library; adjust servings with auto-scaled
quantities; add recipes' ingredients to a shopping list that merges duplicates and groups by aisle;
check items off with persistent, cross-device state — all in the confirmed Warm Editorial design,
running on free tiers.
