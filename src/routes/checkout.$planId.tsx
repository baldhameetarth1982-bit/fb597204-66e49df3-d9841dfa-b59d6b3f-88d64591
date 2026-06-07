import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, ShieldAlert, CreditCard, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/checkout/$planId")({
  head: () => ({ meta: [{ title: "Checkout — SocioHub" }] }),
  component: CheckoutPage,
});

/**
 * Razorpay-gated checkout. The server-side RPC `is_razorpay_live()` decides
 * whether checkout is enabled. There is no client-side bypass: even if a user
 * fakes the boolean, the eventual order-creation server function rejects when
 * razorpay_configured = false (in platform_settings, super-admin only).
 */
function CheckoutPage() {
  const { planId } = Route.useParams();
  const [live, setLive] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.rpc("is_razorpay_live").then(({ data }) => setLive(Boolean(data)));
  }, []);

  const { data: plan } = useQuery({
    queryKey: ["plan", planId],
    queryFn: async () => (await supabase.from("plans").select("*").eq("id", planId).maybeSingle()).data,
  });

  return (
    <main className="min-h-screen bg-[#121212] text-foreground py-12 px-4">
      <div className="max-w-xl mx-auto">
        <Link to="/pricing" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to plans
        </Link>

        <Card className="rounded-2xl bg-[#1E1E1E] border-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[#B91C1C]" /> Checkout
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {plan && (
              <div className="rounded-xl bg-black/30 p-4">
                <p className="text-sm text-muted-foreground">You are subscribing to</p>
                <p className="text-2xl font-semibold mt-0.5">{plan.name}</p>
                <p className="text-lg mt-1">₹{plan.price_monthly_inr}/month · {plan.txn_fee_pct}% transaction fee</p>
              </div>
            )}

            {live === null ? (
              <div className="py-6 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : live ? (
              <Button className="w-full min-h-[56px] rounded-xl bg-[#B91C1C] hover:bg-[#991B1B]"
                onClick={() => alert("Razorpay checkout opens here once order creation is wired.")}>
                Pay securely with Razorpay
              </Button>
            ) : (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">Payments are not enabled yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      The platform owner is finishing Razorpay verification. Plan checkout will go live the moment
                      keys are connected — no action needed on your side.
                    </p>
                    <p className="text-xs text-muted-foreground mt-3">
                      You can still use the 14-day free trial — all features are unlocked.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground text-center">
              By continuing you agree to our <Link to="/terms" className="underline">Terms</Link>.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
