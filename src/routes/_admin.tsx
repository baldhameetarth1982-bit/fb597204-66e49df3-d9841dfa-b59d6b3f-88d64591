import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { ROLES } from "@/config/roles";

/**
 * Super Admin layout. All `/admin/*` routes require SUPER_ADMIN role.
 * Auth wiring is stubbed — replace `getCurrentUser()` with real session lookup
 * once Lovable Cloud auth is enabled.
 */
export const Route = createFileRoute("/_admin")({
  beforeLoad: () => {
    // TODO: read from real session. Currently a no-op stub so build passes.
    const role = null as string | null;
    if (role && role !== ROLES.SUPER_ADMIN) {
      throw redirect({ to: "/login" });
    }
  },
  component: () => <Outlet />,
});
