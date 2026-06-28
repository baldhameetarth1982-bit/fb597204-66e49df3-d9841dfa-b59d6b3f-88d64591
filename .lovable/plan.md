# Replace Phone OTP with Instant Aadhaar Photo Verification

## Why this approach
Firebase phone OTP is fragile (needs reCAPTCHA, billing-tier SMS quotas, breaks in iframes). There is no free official Aadhaar API — UIDAI eKYC requires a licensed AUA/KUA. Instead we use the same trick most early-stage Indian apps use: **OCR + Verhoeff checksum**. It's free, runs in 2–5 seconds, and blocks bots without claiming a government certification we don't have.

## User flow on `/onboarding/create`
1. Remove the entire "Verify your phone" section (phone input, Send OTP, OTP code, Verify button, Firebase recaptcha widget).
2. Replace with a single card titled **"Verify your identity"** containing:
   - A camera/file picker button: "Take photo of Aadhaar (front side)".
   - Inline preview of the selected/captured image.
   - "Verify instantly" button → uploads + runs AI verification.
   - Status pill: idle → uploading → reading → verified ✓ / failed ✗.
3. Once status = verified, the **Create society** submit button unlocks (same gate that `otpStage === "verified"` used).

## Backend pieces

### Storage
- New **private** bucket `kyc-admin`.
- RLS on `storage.objects`:
  - Users can INSERT/SELECT/DELETE only objects under `kyc-admin/<their auth.uid()>/...`.
  - Service role full access.

### Migration
- Add columns to `profiles`:
  - `aadhaar_verified boolean default false`
  - `aadhaar_last4 text` (only last 4 digits stored — never the full 12)
  - `aadhaar_verified_at timestamptz`
- RPC `mark_aadhaar_verified(_last4 text)` — `SECURITY DEFINER`, can only flip its own row, validates `_last4` is 4 digits.

### Server function `verifyAadhaarPhoto` (TanStack `createServerFn` + `requireSupabaseAuth`)
Input: `{ storagePath: string }`.
Steps:
1. Download the image via `supabaseAdmin` from `kyc-admin`.
2. Send to Lovable AI Gateway (`google/gemini-2.5-flash`, vision) with prompt asking to return strict JSON: `{ aadhaar_number, name, dob, is_aadhaar_card }`.
3. Reject if `is_aadhaar_card === false`.
4. Strip spaces from `aadhaar_number`, ensure exactly 12 digits, then run **Verhoeff checksum** (the real UIDAI algorithm — implemented inline, ~30 lines).
5. Compare extracted `name` to the user's `profiles.full_name` using a normalized fuzzy match (token-set ratio ≥ 0.6).
6. If everything passes → call `mark_aadhaar_verified(last4)`, return `{ ok: true, last4 }`.
7. Else return `{ ok: false, reason }` (e.g. "Couldn't read the Aadhaar number", "Name doesn't match your profile").

The submit handler on the create-society form now requires `profile.aadhaar_verified === true` instead of `otpStage === "verified"`.

## Files touched

```text
supabase/migrations/<new>.sql        ── profiles columns + RPC + storage bucket policies
src/lib/aadhaar.ts                   ── Verhoeff checksum + name fuzzy-match helpers
src/lib/aadhaar.functions.ts         ── verifyAadhaarPhoto server function
src/components/onboarding/
    AadhaarVerifyCard.tsx            ── camera/upload UI + status states
src/routes/onboarding.create.tsx     ── strip OTP block, drop in AadhaarVerifyCard,
                                        switch submit gate to aadhaar_verified
src/lib/firebase.ts                  ── leave file (still used elsewhere), remove
                                        only the recaptcha import from create.tsx
```

## Honest disclaimers shown in UI
- Tiny helper text under the card: *"We use AI to read your Aadhaar instantly. Your card image is stored privately and only the last 4 digits are saved."*
- No claim of "UIDAI verified" anywhere.

## Out of scope
- Phone field is removed from society creation. If you later want phone numbers for contact reasons, we add an unverified `contact_phone` field separately.
- Existing resident KYC flow (`society.verifications.tsx`) keeps working as-is — this only touches the **society creation** gate.
