# Pass 2 — Society Admin Screens (staged execution)

Full spec covers ~26 sections across 20+ screens. Executing all of it in a single response would produce shallow, error-prone results across the whole surface. Instead I'll ship Pass 2 in **three tight stages**, each independently verifiable, each preserving Pass 1's shell, tokens, nav, auth, RLS, payments, subscriptions, and business logic.

## Stage 2A — Core daily-use screens (this turn)

Highest-frequency Society Admin surfaces, rebuilt to the reference direction. Real data only; missing metrics hidden (no fake numbers).

1. **Dashboard** (`society.dashboard.tsx`) — action-first: primary tiles (Pending Payments, Pending Approvals, Visitors Today), overview cards (Flats, Collected, Pending Dues, Occupancy), quick actions, recent activity. Hide any card lacking a backend metric.
2. **Residents** (`society.residents.tsx`) — mobile cards (photo/initials, name, flat, owner/tenant chip, mobile, verification chip), search + filter, tabs (All/Owners/Tenants/Family), summary cards. Kill the desktop-table-on-mobile.
3. **Approvals** (`society.approvals.tsx`) — filter chips, request cards with Approve/Reject/View. KYC chips only if `join_requests` actually has that status.
4. **Billing Center** (`society.billing.tsx`) — unified with 4 tabs (Generate / History / Templates / Settings). Existing routes (bill-studio, billing-settings) redirected via link into tabs; not deleted.
5. **More / Operations** (`society.business-profile.tsx` → repurposed as `/society/more` landing, plus operations grouping) — grouped tiles (Management / Finance / Other). Only tiles whose routes exist.

## Stage 2B — Operations & Accounts (follow-up turn)

6. Maintenance dashboard + Matrix polish
7. Accounts Center tabs (Dashboard / Transactions / Reports / Settings)
8. Communication Center (Society Admin variant)
9. Resident Profile detail card layout
10. House/Flat detail

## Stage 2C — Editors & polish (follow-up turn)

11. Generate Bill wizard, Bill History cards, Bill Detail timeline, Templates & Editor
12. Import wizard polish
13. AI Digest redesign

## Non-negotiables (all stages)

- Design tokens only (no hex/`text-white`/`bg-black`).
- No destructive migrations; no DB schema change unless a screen truly needs one (this pass expects none).
- Auth / RLS / payment gateway abstraction / subscription flow untouched.
- No resident cash-payment bypass introduced.
- No fake stats, fake buttons, or placeholder production screens.
- Feature-flag or hide any spec item without backing data/RPC.
- Verify TS + build at end of each stage.

## Deliverables at end of Stage 2A

- Files changed list
- Screens redesigned
- Duplicates hidden (not deleted)
- Features hidden pending backend
- Build/type check result
- Confirmation nothing destructive touched

**Approve Stage 2A to proceed, or tell me to reshuffle scope.**

Approved. Proceed with Stage 2A.

But follow these corrections strictly:

1. Do not create shallow UI.

   I want fewer screens completed properly, not many screens half-broken.

2. Stage 2A must fully finish:

   - Society Admin Dashboard

   - Residents screen

   - Approvals screen

   - Billing Center shell with 4 tabs

   - Society Admin More / Operations screen

3. Use real existing data only.

   If a metric is not available, hide that card.

   Do not show fake numbers.

4. Do not modify:

   - Auth

   - RLS

   - Payment gateway abstraction

   - Razorpay/PayU/Cashfree adapters

   - Subscription logic

   - Maintenance business logic

   - Billing calculation logic

   - Accounts logic

   - Database schema unless absolutely necessary

5. Do not create duplicate routes or duplicate modules.

6. Do not delete existing routes.

   Hide old duplicate navigation items only.

7. Billing Center in this stage should create the correct unified tab structure:

   - Generate

   - History

   - Templates

   - Settings

   But do not deeply rebuild bill generation yet if it belongs to Stage 2C.

8. Society Admin More / Operations must group features clearly:

   Management

   Finance

   Other

   Only show tiles for routes that actually exist.

9. Resident screen must be mobile-card based.

   No desktop table layout on mobile.

10. Approvals screen must use existing join_requests logic.

    Do not invent fake KYC if backend does not support it.

11. After Stage 2A, run:

    - TypeScript check

    - Build check

    - Mobile overflow check at 360/390/414

    - Role navigation check

12. At the end, give me:

    - files changed

    - screens completed

    - screens not touched

    - hidden duplicate UI items

    - backend untouched confirmation

    - build/typecheck result

Do not start Stage 2B in the same code pass unless Stage 2A is fully clean and verified.