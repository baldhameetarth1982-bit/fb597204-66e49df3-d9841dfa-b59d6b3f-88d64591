/**
 * Tiny DB-backed rate limiter for server functions.
 * Fixed 60s windows. Server-only.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function checkRateLimit(opts: {
  bucket: string;
  subject: string;
  limit: number;
  windowSec?: number;
}) {
  const windowSec = opts.windowSec ?? 60;
  const slot = new Date(
    Math.floor(Date.now() / (windowSec * 1000)) * windowSec * 1000,
  ).toISOString();

  const { data: existing } = await supabaseAdmin
    .from("rate_limits")
    .select("count")
    .eq("bucket", opts.bucket)
    .eq("subject", opts.subject)
    .eq("window_start", slot)
    .maybeSingle();

  const current = existing?.count ?? 0;
  if (current >= opts.limit) {
    throw new Error("Too many requests. Please slow down and try again in a moment.");
  }

  if (existing) {
    await supabaseAdmin
      .from("rate_limits")
      .update({ count: current + 1 })
      .eq("bucket", opts.bucket)
      .eq("subject", opts.subject)
      .eq("window_start", slot);
  } else {
    await supabaseAdmin
      .from("rate_limits")
      .insert({ bucket: opts.bucket, subject: opts.subject, window_start: slot, count: 1 });
  }
}
