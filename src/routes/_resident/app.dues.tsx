import { createFileRoute } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { Placeholder } from "@/components/shared/Placeholder";

export const Route = createFileRoute("/_resident/app/dues")({
  head: () => ({ meta: [{ title: "Dues — SocioHub" }] }),
  component: () => (
    <Placeholder
      icon={Wallet}
      title="Dues & Payments"
      description="Pay current bills and view payment history. Coming in Phase 3 (Billing & Razorpay)."
    />
  ),
});
