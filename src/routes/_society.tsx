import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { ROLES } from "@/config/roles";

/** Society Admin layout. All `/society/*` routes require SOCIETY_ADMIN role. */
export const Route = createFileRoute("/_society")({
  beforeLoad: () => {
    const role = null as string | null;
    if (role && role !== ROLES.SOCIETY_ADMIN) {
      throw redirect({ to: "/login" });
    }
  },
  component: () => <Outlet />,
});
