# RecipeGo — Technical / Security Audit

**Reviewer's framing:** read as if a technical interviewer is about to grill you on this repo.
Every claim below is from reading the actual source and running the toolchain — not from the
README or `CLAUDE.md`. File:line citations are exact.

- **Stack (verified from `package.json`):** Next.js `16.2.9` (Turbopack, App Router, uses the
  new `proxy.ts` middleware convention), React `19.2.4`, Supabase (`@supabase/ssr`,
  `@supabase/supabase-js`), Cheerio for scraping, Vitest.
- **Verified by running:** `npm ci` → `npm run lint`, `npm run test:run`, `npm run build`
  (actual output in §1). Plus an empirical SSRF-guard probe (§2, C1).

---

## TL;DR severity table

| # | Severity | Finding | Where |
|---|----------|---------|-------|
| C1 | 🔴 Critical | SSRF: resolved IP never checked; redirects not re-validated | `url-guard.ts`, `fetch-html.ts:5`, `route.ts:72` |
| H1 | 🟠 High | No response-size cap on fetched HTML → OOM DoS | `fetch-html.ts:16` |
| H2 | 🟠 High | No rate limit on the import endpoint (SSRF/DoS amplifier) | `route.ts` (whole handler) |
| H3 | 🟠 High | Image upload: no server-side MIME/size validation; public bucket | `storage.sql:1`, `image-upload.tsx:30` |
| M1 | 🟡 Medium | Import tests mock the fetch → false confidence in "SSRF guard" | `route.test.ts:3`, `url-guard.test.ts` |
| M2 | 🟡 Medium | Realtime `setAuth` called once — token-refresh propagation unproven | `room-realtime.tsx:41` |
| M3 | 🟡 Medium | Build has a hard build-time dependency on Google Fonts | `layout.tsx:2,9` |
| M4 | 🟡 Medium | `npm run lint` fails (19 errors, 2 warnings) | multiple |
| L1 | 🟢 Low | No CI (`.github/` absent) — nothing gates lint/test/build | repo root |
| L2 | 🟢 Low | No `LICENSE` | repo root |
| L3 | 🟢 Low | No screenshots/demo in `README.md` | `README.md` |
| L4 | 🟢 Low | Default `create-next-app` boilerplate SVGs left in `public/` | `public/` |
| L5 | 🟢 Low | `get_shareable_recipe` — broad `SECURITY DEFINER` read (any auth user, any recipe by UUID) | `share_recipe.sql:7` |
| L6 | 🟢 Low | Dead code: `createAdminClient` defined but never called | `admin.ts:4` |
| L7 | 🟢 Low | All import failure modes collapse to one generic response | `route.ts:98` |
| L8 | 🟢 Low | `.gitignore` misses non-`.local` env files | `.gitignore` |
| L9 | 🟢 Low | pgTAP RLS/realtime DB tests never run (no CI, needs Docker) | `supabase/tests/*` |

> **Note on the SSRF blast radius:** the import endpoint **is** auth-gated (the `proxy.ts`
> matcher covers `/api/*`, and `middleware.ts:31` redirects unauthenticated users to `/login`),
> but **sign-up is open** (`login/actions.ts:17` `signup()` calls `supabase.auth.signUp`), so
> "authenticated" is a self-serve bar. C1 stays Critical.

---

## 1. Verification — actual command output

Dependencies were **not** installed on checkout (`node_modules/` absent); ran `npm ci` first (exit 0).

### `npm run lint` → **FAILS** (exit code `1`)
```
✖ 21 problems (19 errors, 2 warnings)
```
- 19 × `@typescript-eslint/no-explicit-any`, concentrated in the recipe-parsing layer:
  `lib/recipe/normalize.ts` (6), `lib/recipe/extract-jsonld.ts` (4), `lib/recipe/find-recipe-node.ts` (2),
  `lib/data/rooms.ts` (3), `components/ui/button.tsx` (2).
- 2 × warnings incl. `react-hooks/set-state-in-effect` at `components/theme-toggle.tsx:14`.
- ⚠️ Earlier "exit 0" readings were `tail` masking the pipeline exit code; the unmasked
  `eslint` exit is **1**. A standard `lint`-gated CI would be red.

### `npm run test:run` → **PASSES**
```
Test Files  24 passed (24)
     Tests  128 passed (128)
  Duration  ~14s
```
Strong coverage of pure logic (units, scaling, ingredient parsing, merge, aisles, week math,
url-guard). Gaps discussed in M1.

### `npm run build` → **FAILS here** (build-time Google Fonts fetch blocked)
```
▲ Next.js 16.2.9 (Turbopack)
> Build error occurred
Error: Turbopack build failed with 2 errors:
  next/font: Failed to fetch `Fraunces` from Google Fonts.
  next/font: Failed to fetch `Inter`   from Google Fonts.
```
**Honest cause:** `layout.tsx:2,9-10` uses `next/font/google` (`Inter`, `Fraunces`), which
downloads font CSS from `fonts.googleapis.com` **at build time**. In this sandbox the egress
proxy returned `403 CONNECT` for `fonts.googleapis.com:443` (confirmed via
`$HTTPS_PROXY/__agentproxy/status` → `connect_rejected … fonts.googleapis.com:443`). On Vercel
or any machine with open egress, this build almost certainly succeeds — so this is **not** a
code defect. The *residual* finding is the build-time network dependency itself (see M3).

### Repo hygiene (verified)
- `.github/` → **absent** (no CI). · `LICENSE` → **absent**. · `README.md` → **no** image/screenshot refs.
- `public/` → only the stock `create-next-app` SVGs (`next.svg`, `vercel.svg`, `window.svg`,
  `globe.svg`, `file.svg`).
- Secrets: only `.env.example` is tracked; `.env`/`.env*.local` are git-ignored. Good.

---

## 2. Findings (critical → nice-to-have)

### 🔴 C1 — SSRF: the *resolved* IP is never validated, and redirects aren't re-checked
**Current state**
- The guard is **string-only**. `lib/recipe/url-guard.ts` checks the URL's *literal* hostname
  against private ranges. Its own line 1 admits the gap:
  `// DNS-rebinding / redirect-to-private is a known residual risk not covered by this static check.`
- `lib/recipe/fetch-html.ts:5` does a plain `fetch(url, { redirect: 'follow' })` — **no** custom
  DNS `lookup`, **no** IP pinning, and it **follows redirects** without re-validating any hop.
- `app/api/import-recipe/route.ts:72` calls `isBlockedImportUrl(url)` **once**, on the original
  string, before the fetch. Nothing ever inspects the address the hostname resolves to.

**Proof (I ran it):**
```
isBlockedImportUrl('http://127.0.0.1.nip.io/')  ->  false   (hostname resolves to 127.0.0.1)
isBlockedImportUrl('http://foo.example/')        ->  false   (attacker points its A record anywhere)
```
So `http://169.254.169.254.nip.io/…` (or any attacker-owned domain whose A record is the cloud
metadata IP) sails through the guard and is then fetched server-side. (Credit where due: decimal
`http://2130706433`, hex `0x7f000001`, and octal `0177.0.0.1` are all normalized to `127.0.0.1`
by the WHATWG `URL` parser and **are** blocked — I verified. The IPv4-mapped-IPv6 handling is
also correct. The hole is specifically *DNS resolution* and *redirects*, not literal encodings.)

**Risk** — Two independent bypasses of the same guard:
1. **DNS → private IP:** a hostname that passes the static check but resolves to loopback /
   `10/8` / `172.16/12` / `192.168/16` / `169.254/16` / `::1` / `fc00::/7`.
2. **Redirect → private IP:** a benign public URL that `30x`-redirects to an internal target;
   `redirect: 'follow'` chases it with no re-check.

An authenticated user (sign-up is open) can make the server issue GET requests to internal
services: cloud metadata, internal admin panels/dashboards, databases on HTTP ports, and
port-scan the private network (blind, via latency/error-type differences). The `10s` timeout
(`fetch-html.ts:3`) and the `Content-Type: html` gate (`fetch-html.ts:15`) are **partial**
mitigations, not a fix: the request still fires (blind SSRF + side effects), and any internal
endpoint that returns `text/html` gets its `<title>`/`og:title`/`og:image` reflected straight
back to the attacker via `route.ts:89-95`. Relying on a content-type check for SSRF safety is
fragile; the correct control is resolved-IP blocking.

**Fix**
- Resolve the host yourself (`dns.lookup(host, { all: true })`); reject if **any** returned
  address is private/loopback/link-local/ULA. Then **pin** the socket to a validated IP via a
  custom `lookup` on an `undici.Agent` (`connect: { lookup }`) so there's no TOCTOU / rebinding
  window between check and connect.
- Set `redirect: 'manual'`, cap hops (e.g. ≤3), and re-run the full guard **and** the
  resolved-IP check on every `Location`. Keep the existing static guard as a cheap pre-filter.
- Add an allowlisted-scheme check at fetch time too (defence in depth).

**Effort:** **M** (~0.5–1 day incl. tests). The moving parts are DNS resolution + connection
pinning + a manual redirect loop; the logic itself is small.

---

### 🟠 H1 — No response-size limit → memory-exhaustion DoS
**Current state:** `lib/recipe/fetch-html.ts:16` — `return await res.text()` buffers the **entire**
body into memory with no byte cap and no `Content-Length` guard.

**Risk:** a target URL (attacker-controlled, or just a huge page) can return hundreds of MB / a
multi-GB stream inside the 10s window; the Node process OOMs. Amplified by the missing rate
limit (H2): one user, repeated calls, server down.

**Fix:** stream the body via `res.body.getReader()`, accumulate with a running byte counter, and
abort once a cap (~2–5 MB is plenty for recipe HTML) is exceeded. Reject early if
`Content-Length` already exceeds the cap.

**Effort:** **S** (~1–2 hrs).

---

### 🟠 H2 — No rate limiting on `/api/import-recipe`
**Current state:** `app/api/import-recipe/route.ts` has no throttle; the only `limit`/`rate`
matches in the codebase are Supabase query `.limit()` calls (`lib/data/profile.ts`,
`lib/data/shopping.ts`), not request rate limiting.

**Risk:** this endpoint fetches arbitrary URLs and buffers responses. With no cap it's a free
SSRF-scanning / DoS-amplification / bandwidth-abuse primitive — spin it in a loop to port-scan
the internal network (with C1) or exhaust memory (with H1).

**Fix:** per-user (and per-IP) rate limit — e.g. a token bucket in Postgres/Upstash, or gate at
the edge. Even a crude in-memory limiter per user id is a meaningful first step for a portfolio.

**Effort:** **S–M** (~2–4 hrs depending on backing store).

---

### 🟠 H3 — Image upload: no server-side type/size validation; bucket is public
**Current state**
- Upload is **client-direct to Supabase Storage** (`components/image-upload.tsx:32`,
  `'use client'`). The only type filter is `accept="image/*"` on the `<input>`
  (`image-upload.tsx:52`) — **client-side, trivially bypassed** by calling the Storage SDK
  directly with the browser's anon key + user JWT.
- The stored extension is taken from the attacker-controlled filename
  (`image-upload.tsx:30` `file.name.split('.').pop()`).
- The bucket is created **`public`** with **no `file_size_limit` and no `allowed_mime_types`**
  (`supabase/migrations/20260628073514_storage.sql:1-3`); read is world-open
  (`storage.sql:5-7` "Anyone can read recipe images").

**Risk**
- **Arbitrary file hosting on your storage domain:** any authenticated user can upload `.html`,
  `.svg`, executables — any MIME. Public-read means the object is served to anyone.
- **Stored XSS (scoped):** an uploaded `.svg`/`.html` served with its native content-type will
  execute JS **when opened directly**. It's on the `*.supabase.co` storage origin (not your app
  origin), so it can't read app cookies — but it's still a hosting/phishing vector and a bad look.
- **Storage abuse:** no size cap → unbounded uploads (cost, quota exhaustion).
- ✅ Good part: write RLS is correctly path-scoped to the owner's folder
  (`storage.sql:9-14`, `(storage.foldername(name))[1] = auth.uid()`), so users can't overwrite
  each other's objects.

**Fix**
- On the bucket, set `allowed_mime_types` (e.g. `image/jpeg,image/png,image/webp`) and a
  `file_size_limit` (e.g. 5 MB) — this is the **server-side** enforcement that actually matters.
- Derive the extension from the sniffed MIME, not the filename. Keep the client `accept` for UX.
- Consider a private bucket + signed URLs if images shouldn't be world-readable.

**Effort:** **S** (~1–2 hrs; mostly a migration + bucket config).

---

### 🟡 M1 — The "SSRF guard" test gives false confidence
**Current state:** `app/api/import-recipe/__tests__/route.test.ts:3-5` mocks `fetchHtml`
entirely, and the only SSRF-labelled assertion (`route.test.ts:21`) just checks that
`file://` returns 400. `url-guard.test.ts` covers the static cases well but has **zero** tests
for the actual attack vectors (DNS→private, redirect→private, size cap) — because the code
doesn't implement those defences.

**Risk:** the suite reads as "SSRF is handled" while the real vectors (C1) are untested and open.
An interviewer who reads the test names then the code will notice the mismatch.

**Fix:** after C1, add tests: a host resolving to `127.0.0.1` is rejected; a redirect to a
private IP is rejected mid-chain; an oversized body is aborted. Use a local HTTP server + a
stub resolver.

**Effort:** **S** (folds into C1/H1).

---

### 🟡 M2 — Realtime auth token is set once; refresh propagation is unverified
**Current state:** `components/room-realtime.tsx:41-43` calls `supabase.realtime.setAuth(access_token)`
exactly once, at subscribe time, using the session captured on mount.

**Risk:** Supabase access tokens expire (~1h). If the refreshed token isn't pushed to the
Realtime socket, RLS-filtered `postgres_changes` can silently stop being delivered on
long-lived tabs until a reload — the UI goes quietly stale. Recent `supabase-js` wires
`onAuthStateChange` → `realtime.setAuth()` automatically, so this **may** already be handled by
the SDK — but the component doesn't make it explicit, and you should be able to say which.

**Fix:** confirm the behaviour (leave a tab open past token expiry and mutate from another
client). If not automatic, subscribe to `supabase.auth.onAuthStateChange` and re-`setAuth` on
`TOKEN_REFRESHED`.

**Effort:** **S** (~1–2 hrs incl. the manual test). *This is exactly the kind of edge an
interviewer probes — see the Q&A in §4.*

---

### 🟡 M3 — Build depends on Google Fonts at build time (non-hermetic)
**Current state:** `layout.tsx:2,9-10` pulls `Inter` + `Fraunces` via `next/font/google`, which
fetches from `fonts.googleapis.com` during `next build`. That's what broke the build in this
sandbox (§1).

**Risk:** any air-gapped / locked-down-CI / offline build fails identically. It also couples your
build to a third party's uptime.

**Fix:** self-host with `next/font/local` (download the `.woff2` once into `public`/`app`), or
ensure your CI allowlists `fonts.googleapis.com` + `fonts.gstatic.com`. Self-hosting makes builds
hermetic and also removes a Google round-trip at runtime.

**Effort:** **S** (~1–2 hrs).

---

### 🟡 M4 — Lint is red (19 errors, 2 warnings)
**Current state:** see §1. Mostly `no-explicit-any` in the recipe-parsing layer + a
`set-state-in-effect` warning at `theme-toggle.tsx:14`.

**Risk:** a portfolio project whose own `lint` fails is a cheap ding. The `any`s in
`normalize.ts`/`extract-jsonld.ts`/`find-recipe-node.ts` are also where untrusted scraped
JSON-LD is handled — the spot you least want untyped.

**Fix:** type the JSON-LD parse path (a small `JsonLdNode`/`unknown`-narrowing shape), and move
`setMounted(true)` off the effect body (or accept the documented pattern and disable the rule
locally). Get `lint` to exit 0.

**Effort:** **S–M** (~2–4 hrs).

---

### 🟢 Low / nice-to-have
- **L1 — No CI (`.github/` absent).** Nothing runs `lint`/`test`/`build` on push, which is why
  M4 rotted unnoticed. Add a GitHub Actions workflow (`npm ci && npm run lint && npm run test:run
  && npm run build`). **Effort: S.**
- **L2 — No `LICENSE`.** For a public portfolio repo, absence means "all rights reserved" by
  default and is ambiguous. Add MIT (or your choice). **Effort: XS.**
- **L3 — No screenshots/demo in `README.md`.** Reviewers skim; a hero screenshot + a live demo
  link dramatically raises first impression. **Effort: S.**
- **L4 — Boilerplate SVGs in `public/`** (`next.svg`, `vercel.svg`, `window.svg`, `globe.svg`,
  `file.svg`). Leftover `create-next-app` cruft reads as unfinished. Delete the unused ones.
  **Effort: XS.**
- **L5 — `get_shareable_recipe` is a broad `SECURITY DEFINER` read** (`share_recipe.sql:7-11`):
  any authenticated user can read *any* recipe's importable content by UUID, bypassing room RLS.
  It's a deliberate "anyone-with-the-link" capability (UUIDv4 = unguessable) and is nicely
  scoped (no `user_id`/`room_id` leaked) with `search_path = ''`. Defensible — just be ready to
  justify it out loud. **Effort: n/a (design note).**
- **L6 — Dead code:** `createAdminClient` (`utils/supabase/admin.ts:4`) is never called anywhere
  in `src/` (only referenced in `docs/`). Harmless — and it means the service-role key path is
  entirely unused — but delete it or wire it up. **Effort: XS.**
- **L7 — Undifferentiated import failures.** `route.ts:98-100` collapses every failure
  (404, timeout, non-HTML, JS-rendered SPA, paywall) into the same `needsManualEntry` 200; the
  client (`import-bar.tsx:22`) shows one generic toast. Functionally *correct* (it never breaks —
  it degrades to manual entry), but users can't tell "not a recipe page" from "site blocked us."
  Return a reason code for better UX. **Effort: S.**
- **L8 — `.gitignore` gap.** Ignores `.env` and `.env*.local` but not `.env.production` /
  `.env.development` (non-`.local`). Tighten to `.env*` (keeping `!.env.example`). **Effort: XS.**
- **L9 — DB tests never run.** `supabase/tests/realtime_publication.test.sql` (and the RLS pgTAP
  tests) require Docker/local Supabase and are "deferred to the owner" — with no CI they never
  execute. Wire `supabase test db` into CI, or at least run once and note it. **Effort: S.**

---

## 3. Realtime — the "walk me through your realtime" script

You asked to actually understand this, from scratch. Here's the whole flow in plain language,
then the exact interview answer.

### 3a. Which mechanism?
**`postgres_changes`** — not `broadcast`, not `presence`. Confirmed at
`components/room-realtime.tsx:47` (`channel.on('postgres_changes', …)`). Mentally:

> Postgres writes to its **Write-Ahead Log** → Supabase's Realtime server tails that WAL via
> **logical replication** → for each change it checks **which subscribed users are allowed to
> see that row (RLS)** → and pushes the change over a **WebSocket** to those users' browsers.

### 3b. What's published, and the `REPLICA IDENTITY FULL` trick
`supabase/migrations/20260704120000_realtime_rooms.sql` adds six tables to the
`supabase_realtime` publication and sets `REPLICA IDENTITY FULL` on each (`realtime_rooms.sql:18-21,40`):

`recipes`, `shopping_list_items`, `meal_plan_entries`, `room_members`, `room_invites`, `rooms`.

(A pgTAP test, `supabase/tests/realtime_publication.test.sql`, asserts exactly these six are
published *and* have full replica identity — though per L9 it isn't run in CI.)

**Why `REPLICA IDENTITY FULL` matters** (great "why" to volunteer in an interview): by default a
change event only carries the row's **primary key** for `UPDATE`/`DELETE`. But the client filters
by `room_id` (below), and on a `DELETE` the PK alone doesn't tell the client *which room* the
deleted row belonged to. `FULL` makes the WAL record include the **entire old row**, so the
`room_id=eq.<id>` filter still matches on deletes. The migration comment
(`realtime_rooms.sql:12-14`) says exactly this.

### 3c. The client flow (`components/room-realtime.tsx`, an invisible `null`-rendering subscriber)
1. **Mount / guard** (`:24-25`): runs in a `useEffect` keyed on `roomId`; bails if no room.
2. **Auth the socket** (`:41-43`): `getSession()`, then `supabase.realtime.setAuth(access_token)`.
   This is the crucial bit — the JWT is what lets the Realtime server evaluate **your** RLS, so
   you only receive rows you're allowed to `SELECT`.
3. **Open one channel** (`:45`): `supabase.channel('room:<roomId>')`.
4. **Subscribe to changes** (`:46-58`): for each room-scoped table, listen to `event: '*'` with
   `filter: room_id=eq.<roomId>`; plus the `rooms` row itself keyed by `id=eq.<roomId>` (a rename
   or delete of the room).
5. **React to a change** (`:33-36`): every event just calls a **debounced (300 ms)**
   `router.refresh()`. It does **not** patch state client-side — it re-runs the server components
   so the page re-renders from fresh DB reads. This is the key design choice: **"notify, then
   refetch,"** not "apply deltas."
6. **Subscribe callback / reconnect** (`:60-64`): on `SUBSCRIBED`, a `connectedOnce` flag
   distinguishes the **first** connect (SSR data is already fresh → do nothing) from a
   **re-subscribe after a network drop** (→ `scheduleRefresh()` to catch up on anything missed
   while offline). `supabase-js` auto-reconnects the socket and re-joins channels, which re-fires
   this callback — that's what makes the catch-up fire.
7. **Cleanup on unmount** (`:69-73`): sets `cancelled`, clears the debounce timer, and
   `supabase.removeChannel(channel)`. **No leak** — this is done correctly. (If you skipped
   `removeChannel`, every navigation would leak a socket subscription.)

### 3d. Why it's secure (say this with confidence)
Realtime here is only as safe as RLS — and the RLS is thorough. Every room table enables RLS with
membership-scoped policies built on `SECURITY DEFINER` helpers (`is_room_member`, `is_room_owner`,
`can_access_recipe`), each pinned with `set search_path = ''`
(`migrations/20260628220000_rooms.sql:34-51,90-152`; `meal_plan.sql:15-29`). Because Realtime
applies your `SELECT` policy per event, a non-member simply **never receives** another room's
changes — which is why the component's comment can say "no manual authorization needed here"
(`room-realtime.tsx:18-19`). That's the sentence that turns "I used Supabase realtime" into "I
understand my trust boundary."

### 3e. Does state re-sync on reconnect, or go stale?
**Re-syncs** — by design (3c step 6). While disconnected you miss events, but the moment the
channel re-subscribes, `connectedOnce` forces a `router.refresh()` that re-pulls current server
state, so you converge. The one edge to keep honest about is M2 (token expiry vs. `setAuth`).

### 3f. Tradeoffs to have ready
- **Refetch-the-page vs. granular updates:** simple and always-consistent (server is the single
  source of truth), at the cost of re-rendering more than strictly changed. Fine at this scale;
  you'd move to targeted cache updates only if bandwidth/re-render cost showed up.
- **300 ms debounce:** coalesces bursts (e.g. bulk shopping-list edits) into one refresh.
- **Per-row `room_id` filter + `FULL` replica identity:** covered above.

---

## 4. Anticipated grilling — quick answers to rehearse
- **"Is your URL import SSRF-safe?"** → *Honest:* "Scheme + literal-IP checks are solid, but the
  resolved IP isn't validated and redirects aren't re-checked — `127.0.0.1.nip.io` gets through.
  The fix is DNS-resolve + IP-pin + manual redirect re-validation." (Owning C1 beats being caught by it.)
- **"What stops a giant response from killing your server?"** → currently nothing (H1); the fix
  is a streamed byte cap.
- **"Can someone upload a non-image?"** → yes today (H3), because the filter is client-side and
  the bucket has no MIME/size policy; fix is `allowed_mime_types` + `file_size_limit`.
- **"Where does the service-role key live?"** → server-only (`admin.ts:1` `import 'server-only'`),
  no `NEXT_PUBLIC_` prefix, and in fact currently unused (L6). The browser client only ever gets
  the anon key (`utils/supabase/client.ts`). It cannot reach the client.
- **"Walk me through your realtime."** → §3.
- **"What happens when the JWT expires on an open tab?"** → M2 — know your answer.

---

## 5. What's already done well (defend these)
- **Auth boundary** via the Next 16 `proxy.ts` convention (`src/proxy.ts`) — you correctly used
  the renamed middleware API instead of legacy `middleware.ts`; it gates all non-public routes
  incl. the import API (`utils/supabase/middleware.ts:26-35`, with the `getUser()`-immediately rule honored).
- **Service-role key containment** — `server-only` + no `NEXT_PUBLIC_` + unused. Textbook.
- **RLS everywhere**, recursion-safe via `SECURITY DEFINER` helpers with `search_path = ''`; the
  realtime security model rests on it and holds.
- **Realtime lifecycle** — correct `removeChannel` cleanup, thoughtful reconnect catch-up.
- **Static SSRF pre-filter** is genuinely thorough (IPv4-mapped IPv6, decimal/hex/octal
  normalization, `.local`/`.internal`, `0.0.0.0`) — verified empirically. It just needs the
  dynamic layer.
- **Host-header hardening** on the internal-recipe shortcut (`route.ts:78` uses the proxy-set
  host, not the client `Host`).
- **128 passing unit tests** over the pure logic; clean separation of `lib/` helpers.
- **Graceful import degradation** — failures fall back to manual entry rather than erroring (L7 is
  a UX refinement, not a bug).

---

## 6. Recommended work order
Ordered by (risk reduction ÷ effort), interview-impact weighted.

1. **C1 — Fix the SSRF** (resolve-and-pin IP + manual redirect re-validation). *M.* The one
   finding that's genuinely dangerous **and** the one you'll be asked about. Do it first.
2. **H1 + H2 — Size cap + rate limit** on the import endpoint. *S each.* Small, and they close
   the DoS/amplification story you opened in C1. Bundle with C1.
3. **M1 — SSRF/size tests.** *S.* Lock the C1/H1 behaviour so it can't regress; turns a weakness
   into a "look, it's tested" talking point.
4. **H3 — Bucket `allowed_mime_types` + `file_size_limit`.** *S.* One migration, real hardening.
5. **M4 + L1 — Green the lint, add CI.** *S–M.* CI makes lint/test/build gate every push; a red
   `lint` on a portfolio repo is free points lost.
6. **M3 — Self-host fonts** (`next/font/local`). *S.* Hermetic, reproducible builds.
7. **M2 — Verify realtime token refresh.** *S.* Cheap certainty on a likely interview question.
8. **Polish sweep — L2/L3/L4/L8** (LICENSE, README screenshots, delete boilerplate SVGs, tighten
   `.gitignore`). *XS–S.* First-impression multipliers.
9. **L5/L6/L7/L9** (document the share capability, drop dead admin client, per-reason import
   feedback, wire DB tests into CI). *XS–S.* Finishing touches.

---
*Audit performed read-only. No source files were modified; nothing was committed. This report
(`AUDIT.md`) is the only file written.*
