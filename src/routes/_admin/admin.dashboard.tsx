import { createFileRoute, Link } from "@tanstack/react-router";
import { LayoutDashboard, Banknote, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_admin/admin/dashboard")({
  head: () => ({ meta: [{ title: "Super Admin — SocioHub" }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  return (
    <div className="px-6 py-8 space-y-6 max-w-5xl">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
          <LayoutDashboard className="h-7 w-7 text-primary" /> Super Admin
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Platform-wide tools for SocioHub operations
        </p>
      </header>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="rounded-2xl group hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary grid place-items-center mb-3">
              <Banknote className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold">Withdrawals</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Review and pay out partner referral commissions.
            </p>
            <Button asChild className="mt-4 rounded-xl">
              <Link to="/admin/withdrawals">
                Open <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
