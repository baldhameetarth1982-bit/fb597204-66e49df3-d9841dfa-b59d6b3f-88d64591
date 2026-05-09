import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/_resident/app/profile")({
  head: () => ({ meta: [{ title: "My profile — SocioHub" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, roles, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">My profile</h1>

      <Card className="rounded-2xl">
        <CardContent className="p-6 flex items-center gap-4">
          <Avatar className="h-16 w-16 ring-1 ring-border">
            <AvatarFallback className="bg-secondary text-primary font-semibold text-lg">
              {(profile?.full_name || user?.email || "U").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-semibold truncate">{profile?.full_name || "Unnamed resident"}</p>
            <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {roles.map((r) => (
                <span key={r} className="text-[11px] rounded-full bg-secondary px-2 py-0.5 font-medium">
                  {r.replace("_", " ")}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Button
        variant="outline"
        className="w-full h-11 rounded-xl text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
        onClick={async () => {
          await signOut();
          navigate({ to: "/login" });
        }}
      >
        <LogOut className="h-4 w-4 mr-2" /> Sign out
      </Button>
    </div>
  );
}
