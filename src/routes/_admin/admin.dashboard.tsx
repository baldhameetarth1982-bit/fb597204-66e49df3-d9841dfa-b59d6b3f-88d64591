import { createFileRoute, Link } from "@tanstack/react-router";
import {
  LayoutDashboard, Banknote, CreditCard, Tags, ArrowRight, BarChart3,
  Megaphone, Users, Building2, ScrollText, ShieldCheck, Settings, TrendingUp, Wallet,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_admin/admin/dashboard")({
  head: () => ({ meta: [{ title: "Super Admin — SocioHub" }] }),
  component: AdminDashboard,
});

const TILES = [
  { to: "/admin/societies", icon: Building2, title: "Societies", desc: "Activate, suspend, grant plans, reset invite codes." },
  { to: "/admin/users", icon: Users, title: "Users", desc: "Every user across the platform." },
  { to: "/admin/revenue", icon: TrendingUp, title: "Revenue", desc: "MRR, ARR, subscription & payment income." },
  { to: "/admin/plans", icon: Tags, title: "Plans", desc: "Basic, Pro, Premium and Enterprise tiers." },
  { to: "/admin/custom-plans", icon: Tags, title: "Custom Plans", desc: "Bespoke pricing for individual societies." },
  { to: "/admin/ads", icon: Megaphone, title: "Ads", desc: "Banner and interstitial placements." },
  { to: "/admin/razorpay", icon: CreditCard, title: "Razorpay", desc: "Gateway keys and payout config." },
  { to: "/admin/withdrawals", icon: Banknote, title: "Withdrawals", desc: "Referral payouts." },
  { to: "/admin/audit", icon: ScrollText, title: "Audit", desc: "Every platform action, searchable." },
  { to: "/admin/security", icon: ShieldCheck, title: "Security", desc: "Roles, permissions and posture." },
  { to: "/admin/settings", icon: Settings, title: "Platform Settings", desc: "Global toggles, fees, ads." },
  { to: "/admin/income", icon: BarChart3, title: "Income", desc: "Detailed payment ledger." },
] as const;

function fmt(n: number) { return "₹" + Math.round(n).toLocaleString("en-IN"); }

function AdminDashboard() {
  const { data: summary } = useQuery({
    queryKey: ["admin-platform-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_platform_summary");
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const { data: rev } = useQuery({
    queryKey: ["admin-mrr"],
    queryFn: async () => {
      const [socs, plans] = await Promise.all([
        supabase.from("societies").select("plan_id").eq("plan_status", "active"),
        supabase.from("plans").select("id, price_monthly_inr"),
      ]);
      const map = new Map<string, number>((plans.data ?? []).map((p: any) => [p.id, p.price_monthly_inr ?? 0]));
      let mrr = 0;
      for (const s of socs.data ?? []) mrr += map.get(s.plan_id ?? "") ?? 0;
      return { mrr };
    },
  });

  return (
    <div className="px-6 py-8 space-y-6 max-w-6xl">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
          <LayoutDashboard className="h-7 w-7 text-primary" /> Super Admin
        </h1>
        <p className="text-sm text-muted-foreground mt-1">The complete platform control center.</p>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric title="Users" value={summary?.total_users ?? "—"} icon={Users} />
        <Metric title="Societies" value={summary?.total_societies ?? "—"} icon={Building2} />
        <Metric title="Active plans" value={summary?.active_societies ?? "—"} icon={Tags} />
        <Metric title="Trials" value={summary?.trialing_societies ?? "—"} icon={Tags} />
        <Metric title="MRR" value={fmt(rev?.mrr ?? 0)} icon={TrendingUp} tone="primary" />
        <Metric title="Payments (all-time)" value={fmt(Number(summary?.successful_payment_total ?? 0))} icon={CreditCard} />
        <Metric title="Outstanding bills" value={fmt(Number(summary?.unpaid_bill_total ?? 0))} icon={Wallet} />
        <Metric title="Platform health" value="Healthy" icon={ShieldCheck} tone="primary" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TILES.map((t) => (
          <Card key={t.to} className="rounded-2xl group hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary grid place-items-center mb-3">
                <t.icon className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-semibold">{t.title}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t.desc}</p>
              <Button asChild className="mt-4 rounded-xl">
                <Link to={t.to}>Open <ArrowRight className="h-4 w-4 ml-1" /></Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Metric({ title, value, icon: Icon, tone }: { title: string; value: number | string; icon: any; tone?: "primary" }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`h-10 w-10 rounded-xl grid place-items-center ${tone === "primary" ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tabular-nums truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
