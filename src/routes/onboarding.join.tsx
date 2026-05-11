import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding/join")({
  head: () => ({ meta: [{ title: "Join society — SocioHub" }] }),
  component: JoinSociety,
});

function JoinSociety() {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    toast("Invite codes coming soon", {
      description: "Ask your admin to add your flat — you'll be linked automatically.",
    });
  }

  return (
    <div className="px-5 py-6 space-y-6">
      <Link
        to="/onboarding"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Link>

      <header className="space-y-2">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 grid place-items-center">
          <KeyRound className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Join your society</h1>
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit invite code shared by your society admin.
        </p>
      </header>

      <Card className="rounded-3xl">
        <CardContent className="p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Invite code</Label>
              <Input
                id="code"
                placeholder="e.g. 4F9K2X"
                maxLength={6}
                className="h-12 rounded-xl text-center tracking-[0.5em] text-lg font-semibold uppercase"
              />
            </div>
            <Button type="submit" className="w-full h-12 rounded-xl">
              Continue
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-xs text-center text-muted-foreground">
        Don't have a code? Ask your admin or{" "}
        <Link to="/onboarding/create" className="text-primary font-medium">
          create a society
        </Link>
        .
      </p>
    </div>
  );
}
