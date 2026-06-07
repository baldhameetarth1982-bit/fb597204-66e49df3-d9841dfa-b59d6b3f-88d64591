import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ArrowLeft, KeyRound, Loader2, CheckCircle2, Upload, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding/join")({
  head: () => ({ meta: [{ title: "Join society — SocioHub" }] }),
  component: JoinSociety,
});

interface Match {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
}

function JoinSociety() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [match, setMatch] = useState<Match | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [joining, setJoining] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [aadhaarLast4, setAadhaarLast4] = useState("");
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);
  const [uploadingKyc, setUploadingKyc] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error("Please enter all 6 characters");
      return;
    }
    setVerifying(true);
    setMatch(null);
    const { data, error } = await supabase.rpc("find_society_by_code", {
      _code: code.toUpperCase(),
    });
    setVerifying(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const row = (data ?? [])[0];
    if (!row) {
      toast.error("No society found for this code");
      return;
    }
    setMatch(row as Match);
  }

  async function handleConfirm() {
    if (!match) return;
    if (!agreed) { toast.error("Please accept the Terms of Service"); return; }
    if (!aadhaarFile) { toast.error("Please upload your Aadhaar card"); return; }
    if (aadhaarLast4.length !== 4 || !/^\d{4}$/.test(aadhaarLast4)) {
      toast.error("Last 4 digits must be numeric"); return;
    }

    const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    const MAX_BYTES = 5 * 1024 * 1024;
    if (!ALLOWED.includes(aadhaarFile.type)) {
      toast.error("Only JPG, PNG, WEBP or PDF files are allowed"); return;
    }
    if (aadhaarFile.size > MAX_BYTES) {
      toast.error("File must be under 5 MB"); return;
    }

    setJoining(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setJoining(false); toast.error("Please sign in again"); return; }

    setUploadingKyc(true);
    const extRaw = (aadhaarFile.name.split(".").pop() || "jpg").toLowerCase();
    const ext = /^[a-z0-9]{1,5}$/.test(extRaw) ? extRaw : "jpg";
    const path = `${user.id}/aadhaar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("kyc").upload(path, aadhaarFile, {
      upsert: true,
      contentType: aadhaarFile.type,
    });
    setUploadingKyc(false);
    if (upErr) { setJoining(false); toast.error(upErr.message); return; }

    const { error } = await supabase.rpc("join_society_with_code", {
      _code: code.toUpperCase(),
    });
    if (error) {
      setJoining(false);
      toast.error(error.message);
      return;
    }
    await (supabase.from("profiles") as any).update({
      accepted_terms_at: new Date().toISOString(),
      aadhaar_url: path,
      aadhaar_last4: aadhaarLast4,
      aadhaar_uploaded_at: new Date().toISOString(),
      aadhaar_verified: false,
    }).eq("id", user.id);

    setJoining(false);
    await refresh();
    toast.success(`Joined ${match.name} — pending admin verification`);
    navigate({ to: "/app/dashboard" });
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
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Invite code</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => {
                  setMatch(null);
                  setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
                }}
                placeholder="e.g. 4F9K2X"
                maxLength={6}
                className="h-12 rounded-xl text-center tracking-[0.5em] text-lg font-semibold uppercase"
              />
            </div>
            {!match ? (
              <Button type="submit" disabled={verifying} className="w-full h-12 rounded-xl">
                {verifying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Verify code
              </Button>
            ) : null}
          </form>

          {match && (
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold">{match.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[match.city, match.state].filter(Boolean).join(", ") || "Location not set"}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-secondary/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">Verify your identity</p>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">
                  Upload your Aadhaar card so the society admin can confirm you live here. Stored privately, encrypted.
                </p>

                <div className="space-y-2">
                  <Label htmlFor="aadhaar4" className="text-xs">Last 4 digits of Aadhaar</Label>
                  <Input
                    id="aadhaar4"
                    inputMode="numeric"
                    placeholder="••••"
                    value={aadhaarLast4}
                    onChange={(e) => setAadhaarLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    className="h-11 rounded-xl tracking-[0.4em] text-center font-semibold"
                  />
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => setAadhaarFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                  className="w-full h-11 rounded-xl gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {aadhaarFile ? aadhaarFile.name : "Upload Aadhaar (image or PDF)"}
                </Button>
              </div>

              <label className="flex items-start gap-2 text-xs text-muted-foreground px-1">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary" />
                <span>
                  I agree to the{" "}
                  <Link to="/terms" target="_blank" className="text-primary underline">
                    Terms of Service &amp; Privacy Policy
                  </Link>
                </span>
              </label>
              <Button
                onClick={handleConfirm}
                disabled={joining || uploadingKyc || !agreed || !aadhaarFile || aadhaarLast4.length !== 4}
                className="w-full h-12 rounded-xl"
              >
                {(joining || uploadingKyc) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {uploadingKyc ? "Uploading…" : "Submit & Join"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setMatch(null)}
                className="w-full h-10 rounded-xl"
              >
                Wrong society? Try another code
              </Button>
            </div>
          )}
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
