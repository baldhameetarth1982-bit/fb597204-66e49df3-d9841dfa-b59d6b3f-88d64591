import type { PaymentGateway } from "./gateway.interface";
import type {
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  GatewayStatus,
  NormalizedWebhookEvent,
  WebhookVerifyInput,
} from "./types";

/**
 * PayU adapter — behind a feature flag until PAYU_MERCHANT_KEY /
 * PAYU_MERCHANT_SALT are provided via add_secret. When credentials are
 * missing this adapter returns `enabled: false` and the UI degrades to a
 * "Coming soon" state without breaking anything else.
 */
export const payuAdapter: PaymentGateway = {
  name: "payu",

  async status(): Promise<GatewayStatus> {
    const enabled = Boolean(
      (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_PAYU_ENABLED === "true"),
    );
    return {
      gateway: "payu",
      enabled,
      live: enabled,
      reason: enabled ? undefined : "PayU credentials not configured yet",
    };
  },

  async createSubscription(_input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    throw new Error("PayU: adapter not yet enabled — add PAYU_MERCHANT_KEY / PAYU_MERCHANT_SALT to enable.");
  },

  async cancelSubscription(_reference: string) {
    throw new Error("PayU: cancelSubscription unavailable until credentials are configured.");
  },

  async verifyWebhook(input: WebhookVerifyInput): Promise<NormalizedWebhookEvent> {
    return { gateway: "payu", type: "unknown", raw: input.rawBody };
  },
};
