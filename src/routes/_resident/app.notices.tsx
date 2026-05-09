import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { Placeholder } from "@/components/shared/Placeholder";

export const Route = createFileRoute("/_resident/app/notices")({
  head: () => ({ meta: [{ title: "Notices — SocioHub" }] }),
  component: () => (
    <Placeholder
      icon={Bell}
      title="Notices"
      description="Society announcements with attachments. Coming in Phase 4 (Communication)."
    />
  ),
});
