import type {
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  GatewayStatus,
  NormalizedWebhookEvent,
  WebhookVerifyInput,
} from "./types";

/**
 * Contract every payment gateway adapter must implement.
 * The onboarding + subscription engine only ever touches this interface.
 */
export interface PaymentGateway {
  readonly name: import("./types").GatewayName;

  /** Cheap health/config check — safe to call at page load. */
  status(): Promise<GatewayStatus>;

  /**
   * Create a recurring subscription (AutoPay/mandate) or a one-time order.
   * Returns a checkoutUrl the browser should navigate to, or a hosted-checkout
   * token the client SDK uses.
   */
  createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult>;

  /** Cancel an active subscription. */
  cancelSubscription(reference: string): Promise<{ ok: boolean }>;

  /** Verify a webhook signature and normalise the event. */
  verifyWebhook(input: WebhookVerifyInput): Promise<NormalizedWebhookEvent>;
}
