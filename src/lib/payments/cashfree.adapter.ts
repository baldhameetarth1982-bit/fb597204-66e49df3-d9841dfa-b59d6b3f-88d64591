import type { PaymentGateway } from "./gateway.interface";
import type {
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  GatewayStatus,
  NormalizedWebhookEvent,
  WebhookVerifyInput,
} from "./types";

/**
 * Cashfree adapter — behind a feature flag until CASHFREE_APP_ID /
 * CASHFREE_SECRET_KEY are configured.
 */
export const cashfreeAdapter: PaymentGateway = {
  name: "cashfree",

  async status(): Promise<GatewayStatus> {
    const enabled = Boolean(
      (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_CASHFREE_ENABLED === "true"),
    );
    return {
      gateway: "cashfree",
      enabled,
      live: enabled,
      reason: enabled ? undefined : "Cashfree credentials not configured yet",
    };
  },

  async createSubscription(_input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    throw new Error("Cashfree: adapter not yet enabled — add CASHFREE_APP_ID / CASHFREE_SECRET_KEY to enable.");
  },

  async cancelSubscription(_reference: string) {
    throw new Error("Cashfree: cancelSubscription unavailable until credentials are configured.");
  },

  async verifyWebhook(input: WebhookVerifyInput): Promise<NormalizedWebhookEvent> {
    return { gateway: "cashfree", type: "unknown", raw: input.rawBody };
  },
};
