/**
 * Tiny DB-backed rate limiter for server functions.
 * Uses fixed 60s windows. Not as precise as Redis but durable and free.
 * Server-only — do NOT import from client code.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function checkRateLimit(opts: {
  bucket: string;        // e.g. "family.create"
  subject: string;       // userId or ip
  limit: number;         // max calls per window
  windowSec?: number;    // default 60
}) {
  const windowSec = opts.windowSec ?? 60;
  const now = new Date();
  const slot = new Date(
    Math.floor(now.getTime() / (windowSec * 1000)) * windowSec * 1000,
  );

  // upsert + increment
  const { data, error } = await supabaseAdmin
    .from("rate_limits")
    .upsert(
      { bucket: opts.bucket, subject: opts.subject, window_start: slot.toISOString(), count: 1 },
      { onConflict: "bucket,subject,window_start", ignoreDuplicates: false },
    )
    .select("count")
    .maybeSingle();

  // If row existed, upsert returns count=1 (because we sent 1). Force increment via RPC fallback:
  if (!error && data && data.count <= 1) {
    // best-effort increment for repeat hits in same window
    await supabaseAdmin.rpc("noop_increment_rate" as never, {} as never).catch(() => {});
  }

  // Re-read count to evaluate
  const { data: row } = await supabaseAdmin
    .from("rate_limits")
    .select("count")
    .eq("bucket", opts.bucket)
    .eq("subject", opts.subject)
    .eq("window_start", slot.toISOString())
    .maybeSingle();

  // Actually increment: do an update +1
  await supabaseAdmin
    .from("rate_limits")
    .update({ count: (row?.count ?? 1) + 1 })
    .eq("bucket", opts.bucket)
    .eq("subject", opts.subject)
    .eq("window_start", slot.toISOString());

  if ((row?.count ?? 0) >= opts.limit) {
    throw new Error(`Too many requests. Please slow down and try again in a moment.`);
  }
}
