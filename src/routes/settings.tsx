import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, User as UserIcon, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, PageShell } from "@/components/shared/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — SocioHub" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, profile, isLoading, isAuthenticated, refresh } = useAuth() as any;
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
  }, [profile]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" />;

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() || null, phone: phone.trim() || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    if (typeof refresh === "function") await refresh();
  }

  return (
    <PageShell>
      <PageHeader
        title="Settings"
        description="Manage your profile and account preferences."
      />
      <div className="grid gap-6 max-w-2xl">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserIcon className="h-5 w-5 text-primary" /> Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email ?? ""} disabled />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 ..."
              />
            </div>
            <Button onClick={save} disabled={saving} className="rounded-xl h-11">
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save changes
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
