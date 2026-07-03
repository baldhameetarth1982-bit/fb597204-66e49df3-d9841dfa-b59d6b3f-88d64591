import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

const TRACKED_ACTIONS = [
  "payment_captured",
  "payment_failed",
  "bill_generated",
  "maintenance_reminder_sent",
  "visitor_entered",
  "visitor_exited",
  "notice_published",
  "complaint_updated",
  "document_uploaded",
];

const STORAGE_KEY = "sh:notif:last_seen";

export function getLastSeen(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || new Date(Date.now() - 7 * 864e5).toISOString();
  } catch {
    return new Date(Date.now() - 7 * 864e5).toISOString();
  }
}

export function markNotificationsSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    window.dispatchEvent(new Event("sh:notif:seen"));
  } catch {}
}

/** Returns unread notification count for the current society. Realtime + polls. */
export function useUnreadNotifications() {
  const { profile } = useAuth();
  const societyId = profile?.society_id;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    window.addEventListener("sh:notif:seen", handler);
    return () => window.removeEventListener("sh:notif:seen", handler);
  }, []);

  const query = useQuery({
    enabled: !!societyId,
    queryKey: ["notifications-unread", societyId, tick],
    staleTime: 15_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const since = getLastSeen();
      const { count } = await supabase
        .from("audit_log")
        .select("id", { count: "exact", head: true })
        .eq("society_id", societyId!)
        .in("action", TRACKED_ACTIONS)
        .gt("created_at", since);
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (!societyId) return;
    const channel = supabase
      .channel(`notif-unread-${societyId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_log", filter: `society_id=eq.${societyId}` },
        () => setTick((t) => t + 1),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [societyId]);

  return query.data ?? 0;
}
