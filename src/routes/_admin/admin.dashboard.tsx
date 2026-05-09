import { createFileRoute } from "@tanstack/react-router";

/** Placeholder — Super Admin dashboard. UI to be built in next phase. */
export const Route = createFileRoute("/_admin/admin/dashboard")({
  component: () => <div className="p-6">Super Admin Dashboard (scaffold)</div>,
});
