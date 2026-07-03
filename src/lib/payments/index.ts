import { supabase } from "@/integrations/supabase/client";
import { cashfreeAdapter } from "./cashfree.adapter";
import { payuAdapter } from "./payu.adapter";
import { razorpayAdapter } from "./razorpay.adapter";
import type { PaymentGateway } from "./gateway.interface";
import type { GatewayName } from "./types";

const REGISTRY: Record<GatewayName, PaymentGateway> = {
  payu: payuAdapter,
  cashfree: cashfreeAdapter,
  razorpay: razorpayAdapter,
};

export function getGateway(name: GatewayName): PaymentGateway {
  const g = REGISTRY[name];
  if (!g) throw new Error(`Unknown payment gateway: ${name}`);
  return g;
}

/**
 * Server-selected gateway from `pricing_settings.active_gateway`.
 * Business code should call this rather than hard-coding a provider.
 */
export async function getActiveGateway(): Promise<PaymentGateway> {
  const { data } = await supabase
    .from("pricing_settings" as any)
    .select("active_gateway")
    .eq("id", 1)
    .maybeSingle();
  const name = ((data as any)?.active_gateway as GatewayName | undefined) ?? "razorpay";
  return getGateway(name);
}

export * from "./types";
export type { PaymentGateway } from "./gateway.interface";
