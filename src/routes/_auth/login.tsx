import { useState, useMemo } from "react";
import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { Loader2, ShieldCheck, Lock, FileCheck2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ROLE_HOME, ROLES } from "@/config/roles";
import { AuthShell } from "@/components/shared/AuthShell";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { PhoneOtpForm } from "@/components/auth/PhoneOtpForm";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { TruecallerButton } from "@/components/auth/TruecallerButton";
import { getCapabilities, startTruecallerAuth } from "@/lib/auth-service";

export const Route = createFileRoute("/_auth/login")({
  head: () => ({
    meta: [
      { title: "Sign in — SocioHub" },
      { name: "description", content: "Sign in to SocioHub — Truecaller, phone OTP, or Google." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { isLoading, isAuthenticated, primaryRole, profile } = useAuth();
  const capabilities = useMemo(() => getCapabilities(), []);
  const [mode, setMode] = useState<"choose" | "phone">("choose");
  const [busy, setBusy] = useState<null | "google" | "truecaller">(null);

  if (isLoading) {
    return (
      <AuthShell>
        <div className="min-h-[200px] grid place-items-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AuthShell>
    );
  }

  if (isAuthenticated) {
    if (primaryRole === ROLES.SUPER_ADMIN) return <Navigate to={ROLE_HOME[ROLES.SUPER_ADMIN]} replace />;
    if (primaryRole && profile?.society_id) return <Navigate to={ROLE_HOME[primaryRole]} replace />;
    // Signed in but no verified phone yet? Route through verify-phone.
    return <Navigate to="/verify-phone" replace />;
  }

  async function withGoogle() {
    setBusy("google");
    try {
      const res = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/verify-phone`,
        extraParams: { prompt: "select_account" },
      });
      if (res.error) throw res.error;
      if (res.redirected) return;
      navigate({ to: "/verify-phone" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Google sign-in failed");
    } finally {
      setBusy(null);
    }
  }

  async function withTruecaller() {
    setBusy("truecaller");
    const r = await startTruecallerAuth();
    setBusy(null);
    if (!r.ok) toast.error(r.error ?? "Truecaller unavailable");
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold tracking-tight text-center">Welcome to SocioHub</h1>
      <p className="mt-2 text-sm text-muted-foreground text-center">
        Society management, simplified.
      </p>

      {mode === "choose" ? (
        <div className="mt-6 space-y-3">
          {capabilities.truecaller && (
            <TruecallerButton onClick={withTruecaller} loading={busy === "truecaller"} />
          )}

          {capabilities.phoneOtp && (
            <Button
              onClick={() => setMode("phone")}
              className="w-full h-12 rounded-2xl font-semibold"
            >
              Continue with Phone
            </Button>
          )}

          <GoogleButton onClick={withGoogle} loading={busy === "google"} />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <PhoneOtpForm
            onVerified={async ({ phone, firebaseUid }) => {
              // For a phone-first user we still need a Supabase session. If none
              // exists yet, ask them to continue with Google to create one and
              // we'll link the phone automatically on the verify-phone screen.
              try {
                const { supabase } = await import("@/integrations/supabase/client");
                const { data } = await supabase.auth.getUser();
                if (!data.user) {
                  toast.info(
                    "Almost there — sign in with Google to link this verified number to your account.",
                  );
                  sessionStorage.setItem("sociohub:pending_phone", JSON.stringify({ phone, firebaseUid }));
                  return;
                }
                await (supabase as any)
                  .from("phone_verifications")
                  .upsert(
                    { user_id: data.user.id, phone, firebase_uid: firebaseUid },
                    { onConflict: "user_id" },
                  );
                toast.success("Phone verified");
                navigate({ to: "/" });
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not link phone");
              }
            }}
          />
          <button
            type="button"
            onClick={() => setMode("choose")}
            className="w-full text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to sign-in options
          </button>
        </div>
      )}

      <div className="mt-6 rounded-2xl bg-secondary/60 p-4 space-y-2">
        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Your data is safe with SocioHub
        </p>
        <ul className="text-[11px] text-muted-foreground space-y-1.5">
          <li className="flex gap-1.5">
            <Lock className="h-3 w-3 mt-0.5 text-primary" /> Encrypted end-to-end, never sold or shared
          </li>
          <li className="flex gap-1.5">
            <FileCheck2 className="h-3 w-3 mt-0.5 text-primary" /> GDPR-aligned, ISO-grade infrastructure
          </li>
        </ul>
        <p className="text-[10px] text-muted-foreground pt-1">
          <Link to="/terms" className="underline">Terms</Link> ·{" "}
          <Link to="/privacy" className="underline">Privacy</Link>
        </p>
      </div>
    </AuthShell>
  );
}
