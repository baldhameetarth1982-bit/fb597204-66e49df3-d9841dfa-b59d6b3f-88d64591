import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, Loader2, User, Home, FileText, Bell, UserCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type Scope = "society" | "resident";

interface Hit {
  id: string;
  type: "resident" | "flat" | "bill" | "visitor" | "post";
  title: string;
  subtitle?: string;
  href: string;
  icon: typeof User;
}

export function GlobalSearch({ societyId, scope }: { societyId: string; scope: Scope }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const query = q.trim();

  useEffect(() => {
    if (query.length < 2) {
      setHits([]);
      return;
    }
    const ctl = new AbortController();
    setBusy(true);
    const run = async () => {
      const like = `%${query}%`;
      const admin = scope === "society";
      const results: Hit[] = [];

      // Residents / profiles
      if (admin) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id, full_name, phone")
          .or(`full_name.ilike.${like},phone.ilike.${like}`)
          .limit(6);
        (prof ?? []).forEach((p: { id: string; full_name: string | null; phone: string | null }) =>
          results.push({
            id: `p-${p.id}`,
            type: "resident",
            title: p.full_name ?? "Resident",
            subtitle: p.phone ?? "",
            href: `/society/residents`,
            icon: User,
          }),
        );
      }

      // Flats
      const { data: flats } = await supabase
        .from("flats")
        .select("id, flat_number, block_id")
        .eq("society_id", societyId)
        .ilike("flat_number", like)
        .limit(6);
      (flats ?? []).forEach((f: { id: string; flat_number: string }) =>
        results.push({
          id: `f-${f.id}`,
          type: "flat",
          title: `Flat ${f.flat_number}`,
          href: admin ? `/society/flats` : `/app/dashboard`,
          icon: Home,
        }),
      );

      // Bills (admin) — by bill_number
      if (admin) {
        const { data: bills } = await supabase
          .from("bills")
          .select("id, bill_number, status, total_amount")
          .eq("society_id", societyId)
          .ilike("bill_number", like)
          .limit(6);
        (bills ?? []).forEach(
          (b: { id: string; bill_number: string; status: string | null; total_amount: number | null }) =>
            results.push({
              id: `b-${b.id}`,
              type: "bill",
              title: b.bill_number,
              subtitle: `${b.status ?? "issued"} · ₹${b.total_amount ?? 0}`,
              href: `/society/billing`,
              icon: FileText,
            }),
        );
      }

      // Visitors
      const { data: vis } = await supabase
        .from("visitors")
        .select("id, visitor_name, phone, flat_number")
        .eq("society_id", societyId)
        .or(`visitor_name.ilike.${like},phone.ilike.${like}`)
        .order("entry_at", { ascending: false })
        .limit(6);
      (vis ?? []).forEach(
        (v: { id: string; visitor_name: string; phone: string | null; flat_number: string | null }) =>
          results.push({
            id: `v-${v.id}`,
            type: "visitor",
            title: v.visitor_name,
            subtitle: [v.flat_number, v.phone].filter(Boolean).join(" · "),
            href: admin ? `/society/visitors` : `/app/visitors`,
            icon: UserCheck,
          }),
      );

      // Posts / announcements
      const { data: posts } = await supabase
        .from("posts")
        .select("id, title, kind, created_at")
        .eq("society_id", societyId)
        .ilike("title", like)
        .order("created_at", { ascending: false })
        .limit(6);
      (posts ?? []).forEach(
        (p: { id: string; title: string; kind: string | null }) =>
          results.push({
            id: `n-${p.id}`,
            type: "post",
            title: p.title,
            subtitle: p.kind ?? "",
            href: admin ? `/society/announcements` : `/app/comm`,
            icon: Bell,
          }),
      );

      if (!ctl.signal.aborted) setHits(results);
      setBusy(false);
    };
    const t = setTimeout(run, 250);
    return () => {
      clearTimeout(t);
      ctl.abort();
      setBusy(false);
    };
  }, [query, societyId, scope]);

  const grouped = useMemo(() => {
    const g: Record<string, Hit[]> = {};
    hits.forEach((h) => {
      (g[h.type] ||= []).push(h);
    });
    return g;
  }, [hits]);

  const LABELS: Record<string, string> = {
    resident: "Residents",
    flat: "Flats",
    bill: "Bills",
    visitor: "Visitors",
    post: "Notices & Posts",
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search residents, flats, bills, visitors, notices…"
          className="pl-9"
          autoFocus
        />
        {busy && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {query.length >= 2 && hits.length === 0 && !busy && (
        <p className="text-sm text-muted-foreground text-center py-8">No results for "{query}"</p>
      )}

      {Object.entries(grouped).map(([type, list]) => (
        <div key={type}>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {LABELS[type]} <Badge variant="secondary" className="ml-1">{list.length}</Badge>
          </div>
          <div className="space-y-1.5">
            {list.map((h) => {
              const Icon = h.icon;
              return (
                <Link key={h.id} to={h.href} className="block">
                  <Card className="hover:bg-accent transition-colors">
                    <CardContent className="p-3 flex items-center gap-3">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{h.title}</div>
                        {h.subtitle && <div className="text-xs text-muted-foreground truncate">{h.subtitle}</div>}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
