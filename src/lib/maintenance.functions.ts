import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** List maintenance periods for a society — grouped per flat. */
export const listSocietyMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ societyId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: periods, error } = await context.supabase
      .from("maintenance_periods")
      .select("id, flat_id, period_label, period_start, amount_due, status, due_date, bill_id, paid_at")
      .eq("society_id", data.societyId)
      .order("period_start", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);

    const { data: flats } = await context.supabase
      .from("flats")
      .select("id, flat_number, blocks(name)")
      .eq("society_id", data.societyId);

    return { periods: periods ?? [], flats: flats ?? [] };
  });

/** Admin: ensure (upsert) a monthly maintenance row for a flat. */
export const ensureMaintenancePeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      flatId: z.string().uuid(),
      periodStart: z.string(), // YYYY-MM-DD
      amount: z.number().min(0).max(1_000_000),
      dueDate: z.string().optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("ensure_maintenance_period", {
      _flat_id: data.flatId,
      _period_start: data.periodStart,
      _amount: data.amount,
      _due_date: data.dueDate ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { id };
  });

/** Admin: bulk seed current month for every assigned flat. */
export const seedCurrentMonthMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ societyId: z.string().uuid(), amount: z.number().min(0).max(1_000_000) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: flats, error } = await context.supabase
      .from("flats")
      .select("id, block_id")
      .eq("society_id", data.societyId)
      .not("block_id", "is", null);
    if (error) throw new Error(error.message);

    const ids = (flats ?? []).map((f: any) => f.id);
    if (!ids.length) return { created: 0 };

    const { data: occ } = await context.supabase
      .from("flat_residents")
      .select("flat_id")
      .in("flat_id", ids);
    const occupied = new Set((occ ?? []).map((r: any) => r.flat_id));

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    let created = 0;
    for (const f of flats as any[]) {
      if (!occupied.has(f.id)) continue;
      const { error: rpcErr } = await context.supabase.rpc("ensure_maintenance_period", {
        _flat_id: f.id,
        _period_start: periodStart,
        _amount: data.amount,
        _due_date: undefined,
      });
      if (!rpcErr) created++;
    }
    return { created };
  });

/** Admin: generate one bill for a flat from selected maintenance periods + extra charges. */
export const generateFlatBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      flatId: z.string().uuid(),
      periodIds: z.array(z.string().uuid()),
      additional: z.array(z.object({
        description: z.string().min(1).max(200),
        amount: z.number().min(0).max(1_000_000),
      })),
      dueDate: z.string().optional().nullable(),
      notes: z.string().max(500).optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: billId, error } = await context.supabase.rpc("generate_flat_bill", {
      _flat_id: data.flatId,
      _period_ids: data.periodIds,
      _additional: data.additional as any,
      _due_date: data.dueDate ?? undefined,
      _notes: data.notes ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { billId };
  });

/** Admin: cancel a bill (reverses linked maintenance periods). */
export const cancelBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ billId: z.string().uuid(), reason: z.string().min(2).max(200) }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("cancel_bill", {
      _bill_id: data.billId,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
