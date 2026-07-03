# Master Phase 1 – Five-Track Stabilization

This is genuinely five separate projects. Attempting all in a single response produces shallow, unverified edits and regressions. I'll do them **sequentially in one thread**, verifying each before the next. Please approve the sequence and I'll start Track 1 immediately.

---

## Track 1 — Phone-as-primary login backend

**Goal:** A user can enter phone → OTP → be signed into Supabase, with no prior account.

**Implementation:**

1. New server route `src/routes/api/public/auth/phone-session.ts` (public prefix, secured by Firebase token verification, not by Supabase auth).
2. Handler:
  - Accept `{ firebaseIdToken, phone }`.
  - Verify token against Google's Firebase public JWKS (`https://www.googleapis.com/robot/v1/metadata/x509/[email protected]`), check `aud === projectId`, `iss === https://securetoken.google.com/<projectId>`, `phone_number === phone`.
  - Load `supabaseAdmin` inside handler (Auth Admin API).
  - Look up user by phone in `phone_verifications` → if exists, get that `user_id`; else `admin.createUser({ phone, phone_confirm: true })` and insert `phone_verifications` row.
  - Mint a session via `admin.auth.admin.generateLink({ type: 'magiclink', email: <synthetic-or-existing> })` **won't work for phone-only**. Instead use `admin.auth.admin.generateLink` OR create a short-lived one-time token flow: return `access_token`/`refresh_token` from `admin.auth.admin.signInWithId` (Supabase JS v2.46+ has `admin.generateLink` for OTP; for phone we use `admin.createSession` if available on this project's version — I'll verify at implementation time and fall back to email-shadow if not).
3. Client change: `PhoneOtpForm` on login gets an alternate `mode="primary"` that POSTs to the new route and calls `supabase.auth.setSession()` with the returned tokens.

**Risks I'll flag before shipping if hit:** Supabase JS admin API on this project may not expose direct session minting. Fallback: sign the user in with a deterministic email like `phone+<uid>@phone.sociohub.local` + service-role-generated password stored in `phone_verifications`; phone remains the UX primary.

**Verification:** curl the new endpoint with a mocked token in dev; then Playwright login via phone against live preview.

---

## Track 2 — Wizard E2E smoke test

Playwright script under `/tmp/browser/wizard/`:

1. Restore injected Supabase session (managed auth is present).
2. Navigate `/onboarding/create`.
3. Walk each wizard step (`societySetup.tsx` blueprint), fill required fields, click Next.
4. Screenshot each step; assert `hierarchy_nodes` rows created via `psql`.
5. Report broken steps, missing validation, console errors.

No code changes unless a bug is found.

---

## Track 3 — Route/build audit

1. Enumerate all files under `src/routes/`.
2. For each: check `errorComponent`, `notFoundComponent`, loading state, empty state.
3. Produce a CSV report at `/mnt/documents/route-audit.csv` (route → has-error → has-notfound → has-loading → has-empty → notes).
4. Fix only the **critical omissions** on `_authenticated` / `_society` / `_resident` roots (protected subtrees where a loader crash blanks the app). Everything else stays in the report as follow-up.

---

## Track 4 — RLS + storage audit

1. `psql` query pg_policies for every `public.*` table.
2. Produce `/mnt/documents/rls-audit.md`: table → policies → society-scoped? → anon exposure?
3. Focus checks: `bills`, `payments`, `flats`, `hierarchy_nodes`, `profiles`, `user_roles`, `join_requests`, `visitors` — must all filter by `society_id` matching the current user's society via `has_role` or equivalent security-definer.
4. File a migration ONLY for confirmed leaks (e.g. anon SELECT on a private table, missing society filter). No speculative rewrites.

---

## Track 5 — Mobile UI pass @ 360px

Playwright at viewport 360×780, signed-in as a resident:

1. Screenshot each authenticated route (`/app/*`).
2. View screenshots; flag horizontal scroll, tap-target < 44px, overflow, illegible text.
3. Fix only clear-cut issues (padding, overflow, sticky headers). Deeper redesigns belong to Phase 4 Enterprise-Dark theme.

---

## What I need from you

**Approve this sequence** (Track 1 → 5 in order, one message per track with verification evidence). Or say "start with Track N" if you want a different order.

If approved, I begin Track 1 in the next message.  for google login use firebase google login not lovable in build because it shows lovable logo when joining society after searching society name society code is required for security purposes 