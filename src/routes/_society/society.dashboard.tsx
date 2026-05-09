import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_society/society/dashboard")({
  component: () => <div className="p-6">Society Admin Dashboard (scaffold)</div>,
});
