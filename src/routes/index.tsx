import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ROLE_HOME } from "@/config/roles";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SocioHub — Society management, simplified" },
      {
        name: "description",
        content:
          "SocioHub helps housing societies collect maintenance, share notices, and manage residents — all in one clean dashboard.",
      },
    ],
  }),
  component: IndexRedirect,
});

function IndexRedirect() {
  const { isLoading, isAuthenticated, primaryRole, profile } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" />;

  // Residents (or users without a society yet) land on the onboarding chooser.
  if (!profile?.society_id && primaryRole !== "super_admin") {
    return <Navigate to="/onboarding" />;
  }

  if (primaryRole) {
    return <Navigate to={ROLE_HOME[primaryRole]} />;
  }

  return <Navigate to="/onboarding" />;
}
