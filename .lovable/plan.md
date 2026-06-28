
# SocioHub → Mobile-First Android-Style Restructure

This is a large change. To avoid breaking the working app (auth, plan gate, billing, RLS, multi-tenant isolation) I'll deliver it in **6 phases**, each independently shippable. You approve this plan, then I execute phase by phase, asking before destructive removals.

---

## Guiding principles (apply to every phase)
- Mobile-first. Design at 360–414px, scale up. No desktop-only tables.
- Material 3 vibe: rounded-2xl cards, FAB, bottom sheets, top app bar, drawer (admin), bottom nav (resident).
- Replace tables → card lists. Replace big modals → `Sheet` (bottom sheet) / expandable cards.
- Preserve existing RLS, plan-gate, Razorpay checkout, KYC, audit log. Only swap UI + add new modules.
- Every new public table: GRANT + RLS + policies in same migration.

---

## Phase 1 — Navigation & Shell (UI-only, zero data risk)
- New `MobileTopBar` (title, back, profile avatar).
- Resident: refined `ResidentBottomNav` — Home, Bills, Visitors, Community, Profile (5 max).
- Society Admin: convert sidebar → **Drawer** (`Sheet` from left) + bottom FAB for "Generate Bill / Add Expense / Add Visitor".
- Guard: single-screen layout (no nav chrome).
- Super Admin: keep current desktop SaaS dashboard (per your earlier ask).
- Global page wrapper `MobileScreen` enforcing safe-area, max-w-md on mobile, max-w-6xl on desktop.

## Phase 2 — Auth & Onboarding rewrite
- Make **Phone OTP (Firebase) primary**. Google login still available but must complete phone verification before dashboard.
- New `/onboarding` shows ONLY two big cards: **Create Society** / **Join Society**. Remove every other onboarding step.
- Join flow: search → select → form (name, flat, owner/tenant) → submit → "Pending Approval" screen → admin approves in `society.verifications`.
- Create flow: name, total flats, structure type, count, address, admin name (phone auto-filled) → straight to plan picker → Razorpay → Setup Wizard.

## Phase 3 — Society Setup Wizard + Accounts opening balances
- 5-step wizard: Society Info → Structure → Maintenance Policy → Accounts (opening cash + bank) → Finish.
- New tables:
  - `society_settings` (maintenance_type prepaid/current/postpaid, monthly_amount, due_day, late_fee, grace_days, opening_cash, opening_bank, opening_set_at).
  - `custom_fields` + `custom_field_values` (per-society dynamic resident profile fields: text/number/dropdown/date/checkbox/file/image).
- Opening balances locked after wizard (DB trigger blocks UPDATE).

## Phase 4 — Maintenance Engine + Billing rewrite
- Remove auto-bill-generation cron behavior for societies that don't opt in. Replace with **"Pending Maintenance" notifications** to residents on due date.
- New "Generate Bill" sheet for admin: pick resident → auto-loads pending months + outstanding → admin selects months + adds N additional charges (category/description/amount) → preview → generate.
- Bills become immutable; expose Send WhatsApp / PNG / PDF / Print actions (PDF via `pdf-lib` client-side).
- Keep existing `bills`/`payments` tables; add `bill_line_items` table for charges.

## Phase 5 — Accounting module
- New tables: `accounts` (cash/bank rows per society), `ledger_txns` (income/expense/adjustment), `financial_years`.
- Every payment insert → auto income txn (DB trigger).
- Expenses entered manually via bottom sheet.
- Balances always derived (`SUM(opening + txns)`) — never stored.
- Reports page: Income / Expense / Collection / Outstanding / Monthly / FY / Cash / Bank with PDF + Excel export (`xlsx` lib).

## Phase 6 — Visitors rewrite + Guard Access Links
- New table `guard_links` (token, society_id, active_device_fingerprint, last_seen, revoked_at).
- Admin generates link → guard opens `/g/$token` → device fingerprint stored on first open → second device triggers admin notification (FCM) + admin can revoke/reset.
- Guard screen: only 4 actions (Entry / Exit / Today / Search).
- Residents: Expected Visitor + Frequent Visitor (maid/cook/etc.) with validity (Today/Tomorrow/Date/Recurring).
- Drop QR-heavy flows.

---

## What I will NOT touch unless you ask
- Existing Razorpay integration, plan-gate RPC (`society_has_access`), KYC RPCs, audit log, RLS helper functions, super-admin user grants — all kept as-is.
- Welcome intro, splash screen, theme system (Neon premium), ad system — kept.
- Family/Emergency screens — Phase 2 will hide them from resident nav (your request) but I'll keep the routes alive until you confirm deletion.

---

## Technical notes (skip if non-technical)
- All new tables get `GRANT` + RLS + `service_role` ALL + scoped `authenticated` policies in the same migration.
- DB triggers enforce: opening-balance immutability, derived-balance protection, bill immutability after generation, single-device guard links.
- Maintenance auto-bill cron will check `society_settings.auto_generate` flag before inserting; default false.
- Custom fields rendered via a single `<DynamicField>` component reading `custom_fields` schema.
- Mobile shell uses CSS `env(safe-area-inset-*)` and `dvh` units.

---

## Execution order I propose
1. You approve plan.
2. I ship **Phase 1** (nav shell) — visible immediately, no DB change.
3. Confirm look/feel, then Phase 2.
4. Continue sequentially. Each phase ends with you testing on mobile preview before the next.

**Reply "go phase 1"** (or specify a different starting phase) and I'll execute. If you want changes to the plan first — say so and I'll revise.
