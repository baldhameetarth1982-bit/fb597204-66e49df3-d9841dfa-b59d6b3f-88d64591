import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { ROLES } from "@/config/roles";

/**
 * Resolves the society_id the current user manages or belongs to.
 * - society_admin: looks up user_roles.society_id (first match)
 * - resident: profile.society_id
 * - super_admin: returns null (must pick a society explicitly)
 */
export function useSocietyId() {
  const { user, profile, hasRole, isLoading: authLoading } = useAuth();
  const [societyId, setSocietyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (authLoading) {
        setLoading(true);
        return;
      }
      setLoading(true);
      if (!user) {
        setSocietyId(null);
        setLoading(false);
        return;
      }
      if (hasRole(ROLES.SUPER_ADMIN)) {
        setSocietyId(null);
        setLoading(false);
        return;
      }

      // Most users already have the tenant on their profile. Return it immediately
      // so established residents/admins never see the create/join onboarding screen.
      if (profile?.society_id) {
        setSocietyId(profile.society_id);
        setLoading(false);
        return;
      }

      if (hasRole(ROLES.SOCIETY_ADMIN)) {
        const { data } = await supabase
          .from("user_roles")
          .select("society_id")
          .eq("user_id", user.id)
          .eq("role", "society_admin")
          .not("society_id", "is", null)
          .limit(1)
          .maybeSingle();
        if (!cancelled) setSocietyId((data?.society_id as string) ?? null);
      } else {
        if (!cancelled) setSocietyId(profile?.society_id ?? null);
      }
      if (!cancelled) setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user, profile?.society_id, hasRole, authLoading]);

  return { societyId, loading };
}
