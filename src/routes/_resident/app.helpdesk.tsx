import { createFileRoute } from "@tanstack/react-router";
import { LifeBuoy } from "lucide-react";
import { Placeholder } from "@/components/shared/Placeholder";

export const Route = createFileRoute("/_resident/app/helpdesk")({
  head: () => ({ meta: [{ title: "Helpdesk — SocioHub" }] }),
  component: () => (
    <Placeholder
      icon={LifeBuoy}
      title="Helpdesk"
      description="Raise complaints and track resolution. Coming in Phase 4."
    />
  ),
});
