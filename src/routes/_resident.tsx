import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { ROLES } from "@/config/roles";

/** Resident layout. All `/app/*` routes require RESIDENT role. Mobile-first. */
export const Route = createFileRoute("/_resident")({
  beforeLoad: () => {
    const role = null as string | null;
    if (role && role !== ROLES.RESIDENT) {
      throw redirect({ to: "/login" });
    }
  },
  component: () => <Outlet />,
});
