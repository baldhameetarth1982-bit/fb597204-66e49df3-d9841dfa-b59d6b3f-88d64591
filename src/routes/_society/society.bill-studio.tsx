import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, Play, Save, IndianRupee, CalendarClock } from "lucide-react";
import { useSocietyId } from "@/hooks/useSocietyId";
import { PageHeader, PageShell, EmptyState } from "@/components/shared/PageHeader";
import { FinanceTabs } from "@/components/shared/FinanceTabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Building2, Plus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getBillingSchedule, saveBillingSchedule, runBillingNow,
} from "@/lib/billing.functions";

export const Route = createFileRoute("/_society/society/bill-studio")({
  head: () => ({ meta: [{ title: "Bill Studio — SocioHub" }] }),
  component: BillStudio,
});

function BillStudio() {
  const { societyId, loading: sidLoading } = useSocietyId();
  const get = useServerFn(getBillingSchedule);
  const save = useServerFn(saveBillingSchedule);
  const runNow = useServerFn(runBillingNow);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [sch, setSch] = useState<any>(null);

  const [mode, setMode] = useState<"flat" | "per_sqft" | "per_bhk">("flat");
  const [amount, setAmount] = useState("2500");
  const [cycle, setCycle] = useState<"weekly" | "monthly" | "quarterly">("monthly");
  const [anchorDay, setAnchorDay] = useState("1");
  const [dueOffsetDays, setDueOffsetDays] = useState("10");
  const [lateFeeType, setLateFeeType] = useState<"none" | "flat" | "percent">("none");
  const [lateFeeValue, setLateFeeValue] = useState("0");
  const [prorate, setProrate] = useState(true);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!societyId) { if (!sidLoading) setLoading(false); return; }
    (async () => {
      try {
        const { schedule } = await get({ data: { societyId } });
        if (schedule) {
          setSch(schedule);
          setMode(schedule.mode as any);
          setAmount(String(schedule.amount));
          setCycle(schedule.cycle as any);
          setAnchorDay(String(schedule.anchor_day));
          setDueOffsetDays(String(schedule.due_offset_days));
          setLateFeeType(schedule.late_fee_type as any);
          setLateFeeValue(String(schedule.late_fee_value));
          setProrate(schedule.prorate);
          setEnabled(schedule.enabled);
        }
      } catch (e: any) { toast.error(e.message); }
      setLoading(false);
    })();
  }, [societyId, sidLoading]);

  async function handleSave() {
    if (!societyId) return;
    setSaving(true);
    try {
      const res = await save({
        data: {
          societyId, mode,
          amount: Number(amount),
          cycle,
          anchorDay: Number(anchorDay),
          dueOffsetDays: Number(dueOffsetDays),
          lateFeeType,
          lateFeeValue: Number(lateFeeValue),
          prorate, enabled,
        },
      });
      toast.success("Schedule saved. Next run " + new Date(res.nextRunAt).toLocaleDateString());
      const { schedule } = await get({ data: { societyId } });
      setSch(schedule);
    } catch (e: any) { toast.error(e.message); }
    setSaving(false);
  }

  async function handleRun() {
    if (!societyId) return;
    setRunning(true);
    try {
      const res = await runNow({ data: { societyId } });
      toast.success(`Generated ${res.count} bills · ₹${res.total.toLocaleString("en-IN")}`);
      const { schedule } = await get({ data: { societyId } });
      setSch(schedule);
    } catch (e: any) { toast.error(e.message); }
    setRunning(false);
  }

  if (sidLoading || loading) {
    return <div className="min-h-[60vh] grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!societyId) {
    return (
      <PageShell>
        <PageHeader title="Bill Studio" description="Automated maintenance billing." />
      <FinanceTabs />
        <EmptyState icon={Building2} title="No society linked" description="Set up your society first." />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Bill Studio"
        description="Set maintenance once — system auto-generates bills every cycle."
        actions={
          <Button onClick={handleRun} disabled={running || !sch} variant="secondary" className="rounded-xl h-11">
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Run now
          </Button>
        }
      />

      <BillAppearanceCard societyId={societyId} />



      {sch && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <Card className="rounded-2xl">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Next auto-run</div>
              <div className="mt-1 flex items-center gap-2 text-lg font-semibold">
                <CalendarClock className="h-4 w-4 text-primary" />
                {new Date(sch.next_run_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Last run</div>
              <div className="mt-1 text-lg font-semibold">
                {sch.last_run_at ? new Date(sch.last_run_at).toLocaleDateString() : "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                {sch.last_run_count ? `${sch.last_run_count} bills · ₹${Number(sch.last_run_total).toLocaleString("en-IN")}` : "Never run"}
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Auto-generate</div>
              <div className="mt-1 flex items-center gap-3">
                <Switch checked={enabled} onCheckedChange={setEnabled} />
                <span className="text-sm font-medium">{enabled ? "ON" : "Paused"}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Billing rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount mode</Label>
              <Select value={mode} onValueChange={(v: any) => setMode(v)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">Flat ₹ per unit</SelectItem>
                  <SelectItem value="per_sqft">₹ × sqft</SelectItem>
                  <SelectItem value="per_bhk">₹ × BHK</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="pl-9 rounded-xl" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Cycle</Label>
              <Select value={cycle} onValueChange={(v: any) => setCycle(v)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Anchor day</Label>
              <Input type="number" min={1} max={28} value={anchorDay} onChange={(e) => setAnchorDay(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Due after (days)</Label>
              <Input type="number" min={0} max={60} value={dueOffsetDays} onChange={(e) => setDueOffsetDays(e.target.value)} className="rounded-xl" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Late fee</Label>
              <Select value={lateFeeType} onValueChange={(v: any) => setLateFeeType(v)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No late fee</SelectItem>
                  <SelectItem value="flat">Flat ₹ per day</SelectItem>
                  <SelectItem value="percent">% per day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Late fee value</Label>
              <Input type="number" min={0} value={lateFeeValue} onChange={(e) => setLateFeeValue(e.target.value)} disabled={lateFeeType === "none"} className="rounded-xl" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border p-4">
            <div>
              <div className="font-medium">Pro-rate new residents</div>
              <div className="text-sm text-muted-foreground">Bill partial cycle if a resident joins mid-period</div>
            </div>
            <Switch checked={prorate} onCheckedChange={setProrate} />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="rounded-xl h-11">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save schedule
            </Button>
          </div>
        </CardContent>
      </Card>

      <OneOffBills societyId={societyId} />
    </PageShell>
  );
}

function OneOffBills({ societyId }: { societyId: string }) {
  const [target, setTarget] = useState<"all" | "block" | "flat">("all");
  const [blockId, setBlockId] = useState<string>("");
  const [flatId, setFlatId] = useState<string>("");
  const [amount, setAmount] = useState("500");
  const [label, setLabel] = useState("Extra charge");
  const [dueDays, setDueDays] = useState("7");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [blocks, setBlocks] = useState<{ id: string; name: string }[]>([]);
  const [flats, setFlats] = useState<{ id: string; number: string; block_id: string | null }[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: b }, { data: f }] = await Promise.all([
        supabase.from("blocks").select("id,name").eq("society_id", societyId).order("name"),
        supabase.from("flats").select("id,number,block_id").eq("society_id", societyId).order("number"),
      ]);
      setBlocks((b as any) ?? []);
      setFlats((f as any) ?? []);
    })();
  }, [societyId]);

  async function submit() {
    if (!amount || Number(amount) <= 0) { toast.error("Enter amount"); return; }
    if (target === "block" && !blockId) { toast.error("Pick a block"); return; }
    if (target === "flat" && !flatId) { toast.error("Pick a flat"); return; }
    setBusy(true);
    try {
      const due = new Date(); due.setDate(due.getDate() + Number(dueDays || 7));
      const { data, error } = await (supabase.rpc as any)("create_oneoff_bills", {
        _society_id: societyId,
        _target: target,
        _block_id: target === "block" ? blockId : null,
        _flat_id: target === "flat" ? flatId : null,
        _amount: Number(amount),
        _label: label,
        _due_date: due.toISOString().slice(0, 10),
        _notes: notes || null,
      });
      if (error) throw error;
      toast.success(`Created ${data ?? 0} bill(s)`);
      setNotes("");
    } catch (e: any) {
      toast.error(e.message ?? "Could not create bills");
    }
    setBusy(false);
  }

  const filteredFlats = blockId ? flats.filter((f) => f.block_id === blockId) : flats;

  return (
    <Card className="rounded-2xl mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary" /> One-off bill</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Send an ad-hoc charge to everyone, a specific block, or a single flat.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Send to</Label>
            <Select value={target} onValueChange={(v: any) => setTarget(v)}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All residents</SelectItem>
                <SelectItem value="block">A block</SelectItem>
                <SelectItem value="flat">One flat</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {target !== "all" && (
            <div className="space-y-1.5">
              <Label>Block</Label>
              <Select value={blockId} onValueChange={(v) => { setBlockId(v); setFlatId(""); }}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>{blocks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {target === "flat" && (
            <div className="space-y-1.5">
              <Label>Flat</Label>
              <Select value={flatId} onValueChange={setFlatId}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>{filteredFlats.map((f) => <SelectItem key={f.id} value={f.id}>{f.number}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Amount (₹)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Due in (days)</Label>
            <Input type="number" min={0} max={90} value={dueDays} onChange={(e) => setDueDays(e.target.value)} className="rounded-xl" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Notes (optional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl" rows={2} />
        </div>
        <div className="flex justify-end">
          <Button onClick={submit} disabled={busy} className="rounded-xl h-11">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Create bill{target !== "flat" ? "s" : ""}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Bill Appearance — logo, signature image, theme color, header text.        */
/* -------------------------------------------------------------------------- */

function BillAppearanceCard({ societyId }: { societyId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [themeColor, setThemeColor] = useState<string>("#0ea5e9");
  const [headerText, setHeaderText] = useState<string>("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSig, setUploadingSig] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("societies")
        .select("logo_url, signature_url, bill_theme, name")
        .eq("id", societyId)
        .maybeSingle();
      if (data) {
        const soc: any = data;
        setLogoUrl(soc.logo_url ?? null);
        setSignatureUrl(soc.signature_url ?? null);
        let theme: any = {};
        try { theme = typeof soc.bill_theme === "string" ? JSON.parse(soc.bill_theme) : (soc.bill_theme ?? {}); }
        catch { theme = {}; }
        setThemeColor(theme.color || "#0ea5e9");
        setHeaderText(theme.header_text || soc.name || "");
      }
      setLoading(false);
    })();
  }, [societyId]);

  async function uploadTo(kind: "logo" | "signature", file: File) {
    const setBusy = kind === "logo" ? setUploadingLogo : setUploadingSig;
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${societyId}/${kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("branding")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage
        .from("branding")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signErr) throw signErr;
      const url = signed?.signedUrl ?? "";
      const patch = kind === "logo" ? { logo_url: url } : { signature_url: url };
      const { error: updErr } = await (supabase as any)
        .from("societies").update(patch).eq("id", societyId);
      if (updErr) throw updErr;
      if (kind === "logo") setLogoUrl(url); else setSignatureUrl(url);
      toast.success(`${kind === "logo" ? "Logo" : "Signature"} uploaded`);
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    }
    setBusy(false);
  }

  async function saveTheme() {
    setSaving(true);
    try {
      const bill_theme = { color: themeColor, header_text: headerText.trim() || null };
      const { error } = await (supabase as any)
        .from("societies").update({ bill_theme }).eq("id", societyId);
      if (error) throw error;
      toast.success("Bill appearance saved");
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    }
    setSaving(false);
  }

  async function removeAsset(kind: "logo" | "signature") {
    const patch = kind === "logo" ? { logo_url: null } : { signature_url: null };
    const { error } = await (supabase as any)
      .from("societies").update(patch).eq("id", societyId);
    if (error) { toast.error(error.message); return; }
    if (kind === "logo") setLogoUrl(null); else setSignatureUrl(null);
    toast.success("Removed");
  }

  if (loading) {
    return (
      <Card className="rounded-2xl mb-6">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-5 w-5 text-primary" /> Bill appearance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Customize how your society's bills look. Upload a real signature image (not just a name) and your society logo — they'll appear on every generated bill.
        </p>

        {/* Live preview */}
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ borderColor: themeColor + "44" }}
        >
          <div className="p-4 flex items-center gap-3" style={{ backgroundColor: themeColor + "18" }}>
            {logoUrl ? (
              <img src={logoUrl} alt="Society logo" className="h-12 w-12 rounded-lg object-contain bg-background border" />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-muted grid place-items-center text-muted-foreground">
                <Building2 className="h-6 w-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate" style={{ color: themeColor }}>{headerText || "Your Society"}</div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Maintenance Bill · Preview</div>
            </div>
          </div>
          <div className="p-4 flex items-end justify-between">
            <div className="text-xs text-muted-foreground">
              This is how the header of every bill PDF / image will look.
            </div>
            {signatureUrl ? (
              <div className="text-center">
                <img src={signatureUrl} alt="Signature" className="h-10 object-contain" />
                <div className="text-[10px] text-muted-foreground border-t pt-0.5">Authorized signatory</div>
              </div>
            ) : (
              <div className="text-[10px] text-muted-foreground text-center">
                <div className="h-10 w-32 border-b border-dashed" />
                <div className="pt-0.5">Signature preview</div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Society logo</Label>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-14 w-14 rounded-lg object-contain border bg-background" />
              ) : (
                <div className="h-14 w-14 rounded-lg bg-muted grid place-items-center text-muted-foreground">
                  <Building2 className="h-6 w-6" />
                </div>
              )}
              <div className="flex-1 space-y-1.5">
                <input
                  id="logo-file"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadTo("logo", f); e.currentTarget.value = ""; }}
                />
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline" size="sm" className="rounded-xl"
                    onClick={() => document.getElementById("logo-file")?.click()}
                    disabled={uploadingLogo}
                  >
                    {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                    Upload from gallery
                  </Button>
                  {logoUrl && (
                    <Button variant="ghost" size="sm" className="rounded-xl text-destructive" onClick={() => removeAsset("logo")}>
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">PNG or JPG, square works best.</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Authorized signature (image)</Label>
            <div className="flex items-center gap-3">
              {signatureUrl ? (
                <img src={signatureUrl} alt="Signature" className="h-14 w-24 rounded-lg object-contain border bg-background" />
              ) : (
                <div className="h-14 w-24 rounded-lg bg-muted grid place-items-center text-muted-foreground text-[10px]">No image</div>
              )}
              <div className="flex-1 space-y-1.5">
                <input
                  id="sig-file"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadTo("signature", f); e.currentTarget.value = ""; }}
                />
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline" size="sm" className="rounded-xl"
                    onClick={() => document.getElementById("sig-file")?.click()}
                    disabled={uploadingSig}
                  >
                    {uploadingSig ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                    Upload signature photo
                  </Button>
                  {signatureUrl && (
                    <Button variant="ghost" size="sm" className="rounded-xl text-destructive" onClick={() => removeAsset("signature")}>
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">Upload a scanned/photo signature — a printed name isn't accepted on official bills.</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Theme color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
                className="h-10 w-14 rounded-lg border cursor-pointer"
                aria-label="Bill theme color"
              />
              <Input
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
                className="rounded-xl font-mono"
                maxLength={9}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Header text</Label>
            <Input
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
              placeholder="Your society name"
              className="rounded-xl"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={saveTheme} disabled={saving} className="rounded-xl h-11">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save appearance
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

