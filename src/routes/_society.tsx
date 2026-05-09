import { Outlet, createFileRoute, Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ROLES, ROLE_HOME } from "@/config/roles";

/** Society Admin layout. All `/society/*` routes require SOCIETY_ADMIN role. */
export const Route = createFileRoute("/_society")({
  component: SocietyGuard,
});

function SocietyGuard() {
  const { isLoading, isAuthenticated, primaryRole, hasRole } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (!hasRole(ROLES.SOCIETY_ADMIN) && !hasRole(ROLES.SUPER_ADMIN)) {
    return <Navigate to={primaryRole ? ROLE_HOME[primaryRole] : "/login"} />;
  }
  return <Outlet />;
}
