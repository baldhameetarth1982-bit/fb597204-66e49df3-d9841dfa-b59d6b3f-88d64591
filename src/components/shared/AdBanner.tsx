import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

/**
 * 320×50 reserved AdMob banner slot. Shown only for societies on the 'basic' plan.
 * Drop in real AdMob/AdSense markup once production keys are configured.
 */
export function AdBanner() {
  const { profile } = useAuth();
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.society_id) return;
    supabase.from("societies").select("plan").eq("id", profile.society_id).maybeSingle()
      .then(({ data }) => setPlan((data?.plan as string) ?? null));
  }, [profile?.society_id]);

  if (plan && plan !== "basic") return null;

  return (
    <div className="w-full flex justify-center py-3" aria-label="Sponsored">
      <div
        style={{ width: 320, height: 50 }}
        className="rounded-lg border border-dashed border-border bg-muted/40 grid place-items-center text-[10px] uppercase tracking-wider text-muted-foreground"
        data-ad-slot="dashboard-bottom-320x50"
      >
        Ad space · 320×50 · Upgrade to remove
      </div>
    </div>
  );
}
