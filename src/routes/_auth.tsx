import { Outlet, createFileRoute } from "@tanstack/react-router";

/** Public auth layout — login, register, password reset. UI to be built. */
export const Route = createFileRoute("/_auth")({
  component: () => <Outlet />,
});
