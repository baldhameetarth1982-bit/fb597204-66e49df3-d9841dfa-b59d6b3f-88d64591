import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, Phone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";

export const Route = createFileRoute("/_auth/phone-otp")({
  head: () => ({ meta: [{ title: "Verify phone — SocioHub" }] }),
  component: PhoneOtpPage,
});

function PhoneOtpPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("+91");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [busy, setBusy] = useState(false);
  const confirmRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    return () => {
      try { recaptchaRef.current?.clear(); } catch {}
    };
  }, []);

  async function sendCode() {
    if (!isFirebaseConfigured()) {
      toast.error("Firebase isn't configured yet. Add the VITE_FB_* secrets.");
      return;
    }
    if (!/^\+\d{8,15}$/.test(phone)) {
      toast.error("Enter phone in international format, e.g. +919876543210");
      return;
    }
    setBusy(true);
    try {
      const auth = getFirebaseAuth();
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
      }
      confirmRef.current = await signInWithPhoneNumber(auth, phone, recaptchaRef.current);
      setStage("code");
      toast.success("OTP sent");
    } catch (e: any) {
      toast.error(e.message ?? "Could not send OTP");
    }
    setBusy(false);
  }

  async function verifyCode() {
    if (!confirmRef.current) return;
    setBusy(true);
    try {
      const res = await confirmRef.current.confirm(code.trim());
      const fbUid = res.user.uid;
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        toast.error("Sign in to your account first to link this phone number.");
        setBusy(false);
        return;
      }
      const { error } = await (supabase as any)
        .from("phone_verifications")
        .upsert({ user_id: u.user.id, phone, firebase_uid: fbUid }, { onConflict: "user_id" });
      if (error) throw new Error(error.message);
      toast.success("Phone verified ✓");
      navigate({ to: "/app/dashboard" });
    } catch (e: any) {
      toast.error(e.message ?? "Wrong code");
    }
    setBusy(false);
  }

  return (
    <div className="min-h-[100dvh] grid place-items-center px-4 py-8 bg-background">
      <Card className="w-full max-w-sm rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {stage === "phone" ? <Phone className="h-5 w-5 text-primary" /> : <ShieldCheck className="h-5 w-5 text-primary" />}
            {stage === "phone" ? "Verify your phone" : "Enter the 6-digit code"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {stage === "phone" ? (
            <>
              <div className="space-y-2">
                <Label>Phone number</Label>
                <Input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="rounded-xl h-12"
                />
                <p className="text-xs text-muted-foreground">Use international format with country code.</p>
              </div>
              <Button onClick={sendCode} disabled={busy} className="w-full h-12 rounded-xl">
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Send code
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>OTP code</Label>
                <Input
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  className="rounded-xl h-12 text-center tracking-[0.5em] text-lg"
                />
              </div>
              <Button onClick={verifyCode} disabled={busy || code.length !== 6} className="w-full h-12 rounded-xl">
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Verify
              </Button>
              <Button variant="ghost" onClick={() => { setStage("phone"); setCode(""); }} className="w-full h-10 rounded-xl">
                Change phone
              </Button>
            </>
          )}
          <div id="recaptcha-container" />
        </CardContent>
      </Card>
    </div>
  );
}
