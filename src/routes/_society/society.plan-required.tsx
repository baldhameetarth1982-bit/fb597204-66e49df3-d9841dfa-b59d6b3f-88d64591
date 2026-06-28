import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Sparkles, ArrowRight, ShieldCheck, Rocket, TrendingUp, Zap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSocietyId } from "@/hooks/useSocietyId";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_society/society/plan-required")({
  head: () => ({ meta: [{ title: "Unlock SocioHub — Renew plan" }] }),
  component: PlanRequired,
});

function PlanRequired() {
  const { signOut } = useAuth();
  const { societyId } = useSocietyId();
  const navigate = useNavigate();

  const { data: society } = useQuery({
    enabled: !!societyId,
    queryKey: ["society-state", societyId],
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const [{ data: row }, { data: access }] = await Promise.all([
        supabase.from("societies").select("id,name,plan_status,trial_ends_at,plan_id").eq("id", societyId!).maybeSingle(),
        supabase.rpc("society_has_access", { _society_id: societyId! }),
      ]);
      return { ...(row ?? {}), has_access: Boolean(access) } as any;
    },
  });

  const { data: plans } = useQuery({
    queryKey: ["plans-required"],
    queryFn: async () =>
      (await supabase.from("plans").select("*").neq("id", "ad_free").neq("id", "trial").neq("id", "resident").order("sort_order")).data ?? [],
  });

  useEffect(() => {
    if (society?.has_access) navigate({ to: "/society/dashboard", replace: true });
  }, [society, navigate]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-5 py-12 space-y-8">
        <div className="text-center space-y-3">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/15 border border-primary/30 grid place-items-center">
            <Rocket className="h-8 w-8 text-primary" />
          </div>
          <Badge className="bg-primary/15 text-primary border-primary/30 rounded-full">
            <Sparkles className="h-3 w-3 mr-1" /> Premium plan ready
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Unlock SocioHub's Full Power
          </h1>
          <p className="text-slate-600 dark:text-slate-300 max-w-xl mx-auto">
            Upgrade {society?.name ? <b>{society.name}</b> : "your society"}'s plan to automate security, finances, and
            community communications — seamlessly.
          </p>
        </div>

        <Card className="rounded-3xl p-6 bg-card border">
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            <Stat icon={<Zap className="h-4 w-4" />} label="Activation" value="Under 60 seconds" />
            <Stat icon={<TrendingUp className="h-4 w-4" />} label="Outcome" value="Save 10+ hrs / month" />
            <Stat icon={<ShieldCheck className="h-4 w-4" />} label="Your data" value="Safe & backed up" />
          </div>
        </Card>

        <div className="grid md:grid-cols-3 gap-5">
          {(plans ?? []).map((p: any) => (
            <Card key={p.id} className={`rounded-3xl p-6 bg-card flex flex-col ${p.is_recommended ? "border-2 border-primary shadow-lg" : "border"}`}>
              {p.is_recommended && (
                <Badge className="self-start mb-3 bg-primary text-primary-foreground"><Sparkles className="h-3 w-3 mr-1" /> Best value</Badge>
              )}
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-50">{p.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-slate-900 dark:text-slate-50">₹{p.price_monthly_inr}</span>
                <span className="text-slate-500 dark:text-slate-400">/mo</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                {p.txn_fee_pct}% txn fee · {p.ads_enabled ? "ads on" : "no ads"}
              </p>
              <Button asChild className={`mt-auto pt-4 min-h-[52px] rounded-xl ${p.is_recommended ? "" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
                <Link to="/checkout/$planId" params={{ planId: p.id }}>
                  Upgrade to {p.name} <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </Card>
          ))}
        </div>

        <div className="text-center text-sm text-slate-600 dark:text-slate-300 space-y-2">
          <p className="flex items-center justify-center gap-2"><ShieldCheck className="h-4 w-4" /> Secured by Razorpay · GST invoice</p>
          <button onClick={() => signOut()} className="underline text-xs text-slate-500 dark:text-slate-400">Sign out</button>
        </div>
      </div>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 rounded-xl bg-primary/10 grid place-items-center text-primary">{icon}</div>
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="font-medium text-slate-900 dark:text-slate-50">{value}</p>
      </div>
    </div>
  );
}
