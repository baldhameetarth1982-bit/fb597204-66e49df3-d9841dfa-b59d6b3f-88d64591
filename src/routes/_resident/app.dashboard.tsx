import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_resident/app/dashboard")({
  component: () => <div className="p-6">Resident Dashboard (scaffold)</div>,
});
