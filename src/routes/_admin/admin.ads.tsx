import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Megaphone, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/admin/ads")({
  head: () => ({ meta: [{ title: "Ads — Super Admin" }] }),
  component: AdsPage,
});

const PLACEMENTS = [
  { id: "dashboard_bottom", label: "Resident dashboard — bottom banner" },
  { id: "feed_inline", label: "Community feed — inline between posts" },
  { id: "notices_top", label: "Notices page — top banner" },
  { id: "bills_after", label: "Bills page — after each bill card" },
] as const;

function AdsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState(true);
  const [interstitial, setInterstitial] = useState(false);
  const [seconds, setSeconds] = useState(15);
  const [placements, setPlacements] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("platform_settings").select("*").eq("id", 1).maybeSingle();
      if (data) {
        setBanner(data.ads_banner_enabled ?? true);
        setInterstitial(data.ads_interstitial_enabled ?? false);
        setSeconds(data.ads_interstitial_seconds ?? 15);
        setPlacements(data.ads_banner_placements ?? []);
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("platform_settings").update({
      ads_banner_enabled: banner,
      ads_interstitial_enabled: interstitial,
      ads_interstitial_seconds: seconds,
      ads_banner_placements: placements,
    }).eq("id", 1);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Ad settings saved");
  }

  if (loading) return <div className="p-12 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="px-6 py-8 max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
          <Megaphone className="h-7 w-7 text-primary" /> Ads
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Controls ads shown on Basic-plan societies. Pro and Premium are always ad-free.
        </p>
      </header>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Banner ads (small)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Enable banner ads</p>
              <p className="text-xs text-muted-foreground">Non-intrusive strips at the bottom of selected screens.</p>
            </div>
            <Switch checked={banner} onCheckedChange={setBanner} />
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Placements</p>
            <div className="grid gap-2">
              {PLACEMENTS.map((p) => (
                <label key={p.id} className="flex items-center gap-3 rounded-xl border p-3 cursor-pointer hover:bg-muted/40">
                  <Checkbox
                    checked={placements.includes(p.id)}
                    onCheckedChange={(c) => {
                      setPlacements((curr) => c ? [...curr, p.id] : curr.filter((x) => x !== p.id));
                    }}
                  />
                  <span className="text-sm">{p.label}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Interstitial / full-screen ads</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Enable full-screen ads</p>
              <p className="text-xs text-muted-foreground">Shown occasionally when opening the app. Skippable after timer.</p>
            </div>
            <Switch checked={interstitial} onCheckedChange={setInterstitial} />
          </div>
          <div className={interstitial ? "" : "opacity-50 pointer-events-none"}>
            <div className="flex items-center justify-between mb-2">
              <Label>Duration (seconds)</Label>
              <span className="font-mono text-sm">{seconds}s</span>
            </div>
            <Slider min={10} max={30} step={1} value={[seconds]} onValueChange={(v) => setSeconds(v[0])} />
            <p className="text-xs text-muted-foreground mt-2">Range: 10–30 seconds.</p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="rounded-xl min-h-[48px] px-6">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Save settings
      </Button>
    </div>
  );
}
