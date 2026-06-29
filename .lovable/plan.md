# Maintenance Payments, Society Payouts & Targeted Billing

## What you'll see after this ships

1. Resident taps **Pay now** → Razorpay opens for the exact bill amount → on success the bill flips to **Paid** and a payment row is logged. No more biometric-then-loop.
2. Each **society admin must attach a bank/UPI** in *Society → Settings → Payouts* before residents can pay online. Until they do, the resident's bill shows **"Online payments not enabled — pay in cash to admin"** and the admin can still mark it paid manually (existing flow).
3. Every successful online maintenance payment is split: **1.5% to SocioHub, 98.5% to that society's bank** — never any other society's.
4. Resident **Dues** screen: the "View full ledger →" link is removed (residents shouldn't see society-wide ledger).
5. Society admin **Bill Studio** gets a new **"One-off bill"** tab with 3 targets: **Whole society**, **One block**, **One flat (extra fee)** — with reason, amount, and due date.

---

## How the money flow works (technical)

We use **Razorpay Route** (Linked Accounts + Transfers) on the SocioHub platform Razorpay account that's already connected:

- Each society stores a `razorpay_account_id` (the linked sub-account Razorpay returns when the admin submits their bank/UPI + PAN).
- When a resident pays, we create a Razorpay **Order** server-side with a `transfers[]` array:
  - 98.5% → society's linked account
  - 1.5% stays in the SocioHub platform account
- Razorpay handles the payout to the society's bank on T+2/T+3.
- Webhook (`/api/public/hooks/razorpay`) verifies signature → marks bill `paid`, inserts `payments` row with `platform_fee` + `society_share`.

If a society has no `razorpay_account_id` yet, the Pay-now button is disabled with a clear message; cash collection still works.

### New / changed DB (one migration)

- `societies`: add `razorpay_account_id text`, `payout_status text default 'not_setup'` (`not_setup` | `pending` | `active` | `rejected`), `payout_bank_last4 text`, `payout_holder_name text`.
- `payments`: add `platform_fee_paise int`, `society_share_paise int`, `razorpay_order_id text`, `razorpay_payment_id text`, `razorpay_signature text`.
- `platform_settings`: add `maintenance_fee_percent numeric default 1.5` (so you can tune it later from Super Admin).
- New RPC `create_oneoff_bills(_society_id, _scope, _block_id, _flat_id, _amount, _title, _due_date)` — scope = `society` | `block` | `flat`. Inserts bill rows with proper RLS guard; runs as society admin only.
- Existing `bills.flat_id` already supports per-flat bills; we just need the admin UI.

### New / changed server functions

- `src/lib/payouts.functions.ts`
  - `createSocietyLinkedAccount({ societyId, holderName, email, phone, accountNumber, ifsc, beneficiaryName, pan })` — calls Razorpay Accounts API, stores `razorpay_account_id`, sets `payout_status='pending'`.
  - `getPayoutStatus({ societyId })` — refreshes status from Razorpay.
- `src/lib/maintenance-pay.functions.ts`
  - `createMaintenanceOrder({ billId })` — fetches bill, ensures society has active `razorpay_account_id`, creates Razorpay Order with `transfers` split, returns `{ orderId, amount, keyId }`.
- `src/routes/api/public/hooks/razorpay.ts` — webhook for `payment.captured` (signature-verified with `RAZORPAY_WEBHOOK_SECRET`). Marks the bill `paid` and writes the `payments` row idempotently keyed on `razorpay_payment_id`.

### Client changes

- `src/lib/razorpay.ts` — add `openRazorpayForOrder({ orderId, keyId, amount, prefill, onSuccess })` (uses real order id instead of client-side amount).
- `src/routes/_resident/app.bills.tsx` and `app.dues.tsx`:
  - **Pay now** → calls `createMaintenanceOrder` → opens Razorpay → on success shows toast and refetches bills. No biometric loop.
  - If `payout_status !== 'active'` for the society → button disabled with helper text "Pay in cash to admin — online payments not set up yet."
- `src/routes/_resident/app.dues.tsx` — delete the `<Link to="/app/ledger">View full ledger →</Link>` block.
- `src/routes/_resident/app.ledger.tsx` — gate to society admins only (redirect residents to `/app/bills`).
- New `src/routes/_society/society.payouts.tsx` — form for bank/UPI + PAN; shows current `payout_status` chip; "Re-submit" if rejected. Added to `SocietyDrawer.tsx` under **Money**.
- `src/routes/_society/society.bill-studio.tsx` — add a second tab **"One-off bill"** with target selector (Whole society / Block / Flat), amount, title, due date, calling `create_oneoff_bills`.

### Super Admin

- `src/routes/_admin/admin.razorpay.tsx` — show platform fee % field bound to `platform_settings.maintenance_fee_percent` (default 1.5), and a list of societies with their payout status.

### Secrets

Already have `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`. Need to add **`RAZORPAY_WEBHOOK_SECRET`** (you set it in Razorpay dashboard → Webhooks for `https://sociohub.live/api/public/hooks/razorpay`, event `payment.captured`). I'll prompt for it via `add_secret`.

---

## Out of scope on purpose

- Refund / partial-pay UI (can come later).
- Auto-retry of failed payouts (Razorpay handles retries).
- Changing the platform fee per society (single global %; tweakable from Super Admin).

---

## Order of work in one build pass

1. Migration (schema + `create_oneoff_bills` RPC + grants/RLS).
2. Server functions: payouts + maintenance-pay + webhook route.
3. Resident Pay-now wiring + remove ledger link + ledger gate.
4. Society Payouts page + drawer entry.
5. Bill Studio one-off tab.
6. Super Admin fee % field.

Approve and I'll ship all six in one go.
