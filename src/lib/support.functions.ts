import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface ChatMsg { role: "user" | "assistant" | "system"; content: string }

const SYSTEM = `You are SocioHub Support, a friendly assistant for residents and committee members of Indian housing societies using the SocioHub app.

You help with: paying maintenance bills, joining/creating a society (6-digit code), visitor logs, polls, ledger/finances, vehicle management, community feed, and general "how do I…" questions.

Rules:
- Keep replies short (2-4 sentences) and warm.
- If the user asks something outside SocioHub (legal advice, weather, jokes), politely redirect.
- If you genuinely cannot help — billing dispute, account access lost, suspected bug, payment failed — reply with EXACTLY this token on its own line at the end: [ESCALATE]
  Then on the next lines, write a concise "subject:" and "summary:" the support team can act on.`;

/** Chat with AI; returns message + escalate flag + parsed ticket draft if escalated. */
export const supportChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      messages: z.array(z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().min(1).max(4000),
      })).min(1).max(40),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: SYSTEM }, ...data.messages] as ChatMsg[],
      }),
    });
    if (res.status === 429) throw new Error("Too many requests. Try again in a minute.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please contact support directly.");
    if (!res.ok) throw new Error(`AI error: ${res.status}`);

    const json = (await res.json()) as any;
    const reply: string = json.choices?.[0]?.message?.content ?? "";

    const escalate = /\[ESCALATE\]/i.test(reply);
    let subject: string | null = null;
    let summary: string | null = null;
    if (escalate) {
      const subM = reply.match(/subject:\s*(.+)/i);
      const sumM = reply.match(/summary:\s*([\s\S]+)/i);
      subject = subM?.[1]?.trim() ?? "Support request";
      summary = sumM?.[1]?.trim() ?? reply.replace(/\[ESCALATE\]/gi, "").trim();
    }
    return { reply: reply.replace(/\[ESCALATE\][\s\S]*$/i, "").trim(), escalate, subject, summary };
  });

/** Persist an AI-escalated ticket. */
export const createSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      subject: z.string().min(3).max(200),
      description: z.string().min(5).max(4000),
      transcript: z.array(z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      })).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles").select("society_id").eq("id", userId).maybeSingle();
    const { data: row, error } = await supabase
      .from("support_tickets")
      .insert({
        user_id: userId,
        society_id: prof?.society_id ?? null,
        subject: data.subject,
        description: data.description,
        ai_transcript: data.transcript ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });
