import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, ShieldAlert, CreditCard, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { RAZORPAY_CONFIG } from "@/config/app";

export const Route = createFileRoute("/checkout/$planId")({
  head: () => ({ meta: [{ title: "Checkout — SocioHub" }] }),
  component: CheckoutPage,
});

declare global {
  interface Window { Razorpay?: any }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function CheckoutPage() {
  const { planId } = Route.useParams();
  const { profile, user } = useAuth();
  const [live, setLive] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.rpc("is_razorpay_live").then(({ data }) => setLive(Boolean(data)));
  }, []);

  const { data: plan } = useQuery({
    queryKey: ["plan", planId],
    queryFn: async () => (await supabase.from("plans").select("*").eq("id", planId).maybeSingle()).data,
  });

  async function startPayment() {
    if (!plan) return;
    const keyId = RAZORPAY_CONFIG.keyId;
    if (!keyId) {
      toast.error("Razorpay key not configured. Add VITE_RAZORPAY_KEY_ID to .env.");
      return;
    }
    setBusy(true);
    const ok = await loadRazorpayScript();
    if (!ok) { setBusy(false); toast.error("Could not load Razorpay. Check your internet."); return; }

    // Dummy / test checkout — once an order-creation server function is wired,
    // replace `amount` and add `order_id` returned from the server.
    const options = {
      key: keyId,
      amount: Math.max(plan.price_monthly_inr, 1) * 100,
      currency: RAZORPAY_CONFIG.currency,
      name: "SocioHub",
      description: `${plan.name} plan — monthly`,
      prefill: { email: profile?.email ?? user?.email ?? "", contact: profile?.phone ?? "" },
      theme: { color: "#B91C1C" },
      handler: function (resp: any) {
        toast.success(`Payment captured: ${resp.razorpay_payment_id}`);
      },
      modal: { ondismiss: () => setBusy(false) },
    };
    const rzp = new window.Razorpay!(options);
    rzp.on("payment.failed", (resp: any) => {
      toast.error(resp?.error?.description ?? "Payment failed");
      setBusy(false);
    });
    rzp.open();
  }

  return (
    <main className="min-h-screen bg-background text-foreground py-12 px-4">
      <div className="max-w-xl mx-auto">
        <Link to="/pricing" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to plans
        </Link>

        <Card className="rounded-2xl border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" /> Checkout
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {plan && (
              <div className="rounded-xl bg-secondary p-4">
                <p className="text-sm text-muted-foreground">You are subscribing to</p>
                <p className="text-2xl font-semibold mt-0.5 text-slate-900 dark:text-slate-50">{plan.name}</p>
                <p className="text-lg mt-1">₹{plan.price_monthly_inr}/month · {plan.txn_fee_pct}% transaction fee</p>
              </div>
            )}

            {live === null ? (
              <div className="py-6 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : live ? (
              <Button onClick={startPayment} disabled={busy} className="w-full min-h-[56px] rounded-xl">
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
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
                      keys are connected.
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
