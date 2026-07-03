import { supabase } from "@/integrations/supabase/client";

export async function regenerateSocietyInviteCode(societyId: string): Promise<string> {
  const { data, error } = await supabase.rpc("regenerate_society_invite_code", {
    _society_id: societyId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function setSocietyInviteCodeCustom(societyId: string, code: string): Promise<string> {
  const { data, error } = await supabase.rpc("set_society_invite_code_custom", {
    _society_id: societyId,
    _code: code,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function setSocietyInviteCodeEnabled(societyId: string, enabled: boolean) {
  const { error } = await supabase.rpc("set_society_invite_code_enabled", {
    _society_id: societyId,
    _enabled: enabled,
  });
  if (error) throw new Error(error.message);
}

export async function getSocietyInviteState(societyId: string) {
  const { data } = await (supabase as any)
    .from("societies")
    .select("invite_code, invite_code_enabled")
    .eq("id", societyId)
    .maybeSingle();
  return (data ?? null) as { invite_code: string; invite_code_enabled: boolean } | null;
}
