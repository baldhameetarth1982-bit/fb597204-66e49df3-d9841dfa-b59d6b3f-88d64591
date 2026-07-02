
## Razorpay Merchant Compliance Overhaul

Goal: make SocioHub look like a mature, legally compliant SaaS so Razorpay activation and merchant review pass cleanly.

### 1. Legal Center (4 policy routes)

Rewrite / create formal enterprise-tone legal pages. All contact points use `sociohub710@gmail.com` and `Pethapur, Gandhinagar, Gujarat — 382610`.

- `src/routes/legal.tsx` — Legal Center hub with 4 cards linking to the sub-pages, plus last-updated date.
- `src/routes/privacy.tsx` (rewrite existing) — Privacy Policy:
  - Data collected: name, flat/unit details, contact number, email, KYC (Aadhaar last-4 only shown), payment metadata.
  - No sale of data to third parties.
  - SSL / TLS 1.2+ in transit, encryption at rest, Razorpay PCI-DSS for card data (we never store card numbers).
  - User rights: access, correction, deletion via grievance email.
- `src/routes/terms.tsx` (rewrite) — Terms & Conditions:
  - SocioHub is a SaaS platform provider, NOT the society administration.
  - Maintenance payments = society dues collected on behalf of the society admin; SocioHub only charges a 1.5% platform fee.
  - Acceptable use, account termination, limitation of liability, governing law (India, Gujarat jurisdiction).
- `src/routes/refund.tsx` (NEW) — Refund & Cancellation Policy with the exact wording requested:
  > "Transactions processed for society maintenance are final. Refunds are only applicable in case of double-payment or technical failure. Requests must be submitted via sociohub710@gmail.com within 48 hours. Valid refunds will be credited back to the original source within 5-7 working days."
  - Add matching clause for SaaS plan cancellations (pro-rated NOT offered; cancel to stop renewal).
- `src/routes/contact.tsx` (NEW) — Contact & Grievance:
  - Grievance Officer: Support Team
  - Email: sociohub710@gmail.com
  - Address: Pethapur, Gandhinagar, Gujarat — 382610
  - Response SLA: 48 business hours.

### 2. Transaction transparency

- New shared component `src/components/payments/TransactionSummaryModal.tsx`:
  - Rows: Item, Amount, Platform Fee (1.5% for maintenance, 0 for SaaS plans), GST if applicable, **Total**.
  - Footer strip: shield icon + "Secured by Razorpay · 128-bit SSL Encrypted".
  - Buttons: Cancel / **Pay Now** (opens Razorpay via existing `openRazorpayCheckout` / `openRazorpayForOrder`).
- Wire it into:
  - `src/routes/checkout.$planId.tsx` (plan purchase)
  - `src/routes/_resident/app.bills.tsx` and `app.dues.tsx` (maintenance pay button)
  - `src/routes/pricing.tsx` upgrade CTA
- Persistent security badge: add a small `<PaymentSecurityBadge />` under every checkout entry.

### 3. Merchant legitimacy — Business Profile

- Migration: add columns to `societies` — `legal_business_name TEXT`, `business_address TEXT`, `business_city TEXT`, `business_state TEXT`, `business_pincode TEXT`, `business_gstin TEXT NULL`, `business_pan TEXT NULL`. Add RPC `update_society_business_profile(...)` guarded by `is_society_admin_for`.
- New page `src/routes/_society/society.business-profile.tsx`:
  - Form for the fields above with helper text: "Must match name submitted to Razorpay."
  - Show green "Ready for Razorpay activation" badge when all required fields are filled AND payout linked.
- Link entry from society Settings and from `society.payouts.tsx` (prerequisite gate before "Attach Bank").

### 4. Global footer

- New component `src/components/shared/LegalFooter.tsx` — high-contrast, always visible on:
  - `src/routes/__root.tsx` (site-wide)
  - Login/auth screens (`_auth` layout)
  - Checkout screens
  - Resident & society shells (above the mobile bottom-nav with correct safe-area padding so it doesn't collide)
- Links: Privacy · Terms · Refund · Contact · "Secured by Razorpay". Small copyright line with legal entity name.

### 5. UI stability polish

- Remove "Beta", "Coming Soon", "Test" strings — grep and replace across `src/routes/**` and `src/components/**`. Any still-incomplete surface gets a neutral empty-state instead ("No data yet").
- Checkout error handling:
  - `createMaintenanceOrder` / plan checkout: surface Razorpay error `description` via toast, keep user on same page, log to `error_log` server fn.
  - Add fallback empty routes so no button leads to a blank page.
- Verify `checkout.$planId.tsx` guards against manual URL bypass (already RPC-gated; add double-check).

### Technical notes

- Files created: `src/routes/legal.tsx`, `src/routes/refund.tsx`, `src/routes/contact.tsx`, `src/routes/_society/society.business-profile.tsx`, `src/components/payments/TransactionSummaryModal.tsx`, `src/components/payments/PaymentSecurityBadge.tsx`, `src/components/shared/LegalFooter.tsx`.
- Files edited: `src/routes/privacy.tsx`, `src/routes/terms.tsx`, `src/routes/__root.tsx`, `src/routes/_auth.tsx`, `src/routes/checkout.$planId.tsx`, `src/routes/pricing.tsx`, `src/routes/_resident/app.bills.tsx`, `src/routes/_resident/app.dues.tsx`, `src/routes/_society/society.payouts.tsx`, `src/layouts/ResidentLayout.tsx`, sidebar/settings entry points.
- Migration: `societies` business profile columns + `update_society_business_profile` RPC (GRANT EXECUTE to authenticated, RLS via `is_society_admin_for`).
- No new deps.
- Head metadata: each new legal route gets its own `head()` with unique title/description and canonical link.

Confirm and I'll execute in build mode.
