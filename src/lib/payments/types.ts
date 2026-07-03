/**
 * Payment Gateway Abstraction — shared types.
 *
 * All onboarding, subscription and pricing code communicates with this layer
 * instead of any concrete provider. New gateways can be added by implementing
 * `PaymentGateway` in `gateway.interface.ts` and registering them in `index.ts`.
 */

export type GatewayName = "payu" | "cashfree" | "razorpay";

export interface SubscriptionPlanRef {
  id: string;
  name: string;
  price_monthly_inr: number;
}

export interface CustomerRef {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface CreateSubscriptionInput {
  gateway: GatewayName;
  plan: SubscriptionPlanRef;
  societyId: string;
  customer: CustomerRef;
  successUrl?: string;
  cancelUrl?: string;
  /** Idempotency key to prevent duplicate subscription creation on double-tap */
  idempotencyKey?: string;
}

export interface CreateSubscriptionResult {
  gateway: GatewayName;
  /** hosted checkout URL to redirect to, when applicable */
  checkoutUrl?: string;
  /** provider-specific reference (subscription id, token, etc.) */
  reference: string;
  /** any data client needs to hand back on return */
  metadata?: Record<string, unknown>;
}

export interface WebhookVerifyInput {
  headers: Record<string, string | null | undefined>;
  rawBody: string;
}

export interface NormalizedWebhookEvent {
  gateway: GatewayName;
  type:
    | "subscription.activated"
    | "subscription.charged"
    | "subscription.canceled"
    | "subscription.failed"
    | "payment.captured"
    | "payment.failed"
    | "unknown";
  subscriptionRef?: string;
  paymentRef?: string;
  amountInPaise?: number;
  currency?: string;
  occurredAt?: string;
  raw: unknown;
}

export interface GatewayStatus {
  gateway: GatewayName;
  enabled: boolean;
  live: boolean;
  reason?: string;
}
