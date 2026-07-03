import { useState } from "react";
import { Loader2, Phone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  startPhoneOtp,
  verifyPhoneOtp,
  linkVerifiedPhoneToCurrentUser,
  resetOtpState,
} from "@/lib/auth-service";

interface Props {
  /** Called with the raw firebase idToken + phone once verification succeeds. */
  onVerified: (result: { phone: string; firebaseUid: string; firebaseIdToken: string }) => void;
  /** If true, also links the verified phone to the current Supabase user (used post-Google). */
  linkToCurrentUser?: boolean;
  submitLabel?: string;
}

export function PhoneOtpForm({ onVerified, linkToCurrentUser, submitLabel }: Props) {
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("+91");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    setBusy(true);
    const r = await startPhoneOtp(phone);
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error ?? "Could not send OTP");
      return;
    }
    setStage("code");
    toast.success("OTP sent");
  }

  async function verify() {
    setBusy(true);
    const r = await verifyPhoneOtp(code);
    if (!r.ok || !r.firebaseUid || !r.firebaseIdToken) {
      setBusy(false);
      toast.error(r.error ?? "Wrong code");
      return;
    }
    if (linkToCurrentUser) {
      const link = await linkVerifiedPhoneToCurrentUser(phone, r.firebaseUid);
      if (!link.ok) {
        setBusy(false);
        toast.error(link.error ?? "Could not link phone");
        return;
      }
    }
    setBusy(false);
    resetOtpState();
    onVerified({ phone, firebaseUid: r.firebaseUid, firebaseIdToken: r.firebaseIdToken });
  }

  return (
    <div className="space-y-4">
      {stage === "phone" ? (
        <>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm">
              <Phone className="h-4 w-4 text-primary" /> Mobile number
            </Label>
            <Input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+919876543210"
              className="rounded-2xl h-12 text-base"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">
              Include country code. We'll text you a 6-digit code.
            </p>
          </div>
          <Button
            onClick={sendCode}
            disabled={busy}
            className="w-full h-12 rounded-2xl text-base font-semibold"
          >
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Send code
          </Button>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm">
              <ShieldCheck className="h-4 w-4 text-primary" /> Enter code
            </Label>
            <Input
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className="rounded-2xl h-14 text-center tracking-[0.5em] text-2xl font-semibold"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">
              Sent to <span className="text-foreground font-medium">{phone}</span>
            </p>
          </div>
          <Button
            onClick={verify}
            disabled={busy || code.length !== 6}
            className="w-full h-12 rounded-2xl text-base font-semibold"
          >
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {submitLabel ?? "Verify"}
          </Button>
          <button
            type="button"
            onClick={() => {
              setStage("phone");
              setCode("");
            }}
            className="w-full text-sm text-muted-foreground hover:text-foreground"
          >
            Change number
          </button>
        </>
      )}
      <div id="recaptcha-container" />
    </div>
  );
}
