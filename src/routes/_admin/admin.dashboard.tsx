import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";
import { Placeholder } from "@/components/shared/Placeholder";

export const Route = createFileRoute("/_admin/admin/dashboard")({
  head: () => ({ meta: [{ title: "Super Admin — SocioHub" }] }),
  component: () => (
    <Placeholder
      icon={LayoutDashboard}
      title="Super Admin Dashboard"
      description="Global analytics, society approvals, and platform revenue. Coming in Phase 6."
    />
  ),
});
