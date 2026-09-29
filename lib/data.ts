import type { SupabaseClient } from "@supabase/supabase-js";
import type { Bottleneck, CallReflection, DailyEntry, Drill, DrillLog, Comment, Profile } from "./types";
import { addDays, dayOf } from "./dates";

export interface ParticipantBundle {
  entries: DailyEntry[];
  bottlenecks: Bottleneck[];
  active: Bottleneck | null;
  proposed: Bottleneck | null;
  reflections: CallReflection[];
  drills: Drill[];
  logs: DrillLog[];
}

/** Lädt alles, was Dashboard und Engpass-Seite eines Teilnehmers brauchen. RLS sorgt für die Rechte. */
export async function loadParticipant(supabase: SupabaseClient, participantId: string, today: string): Promise<ParticipantBundle> {
  const since = addDays(today, -200);
  const [entryRows, bnRes, reflRows] = await Promise.all([
    fetchAll<DailyEntry>(() => supabase.from("daily_entries").select("*").eq("participant_id", participantId).gte("day", since).order("day")),
    supabase.from("bottlenecks").select("*").eq("participant_id", participantId).order("seq"),
    fetchAll<CallReflection>(() => supabase.from("call_reflections").select("*").eq("participant_id", participantId).gte("day", since).order("day").order("created_at").order("id")),
  ]);
  const bottlenecks = (bnRes.data ?? []) as Bottleneck[];
  const active = bottlenecks.find((b) => b.status === "active") ?? null;
  const proposed = [...bottlenecks].reverse().find((b) => b.status === "proposed") ?? null;
  const current = active ?? proposed;

  let drills: Drill[] = [];
  let logs: DrillLog[] = [];
  if (current) {
    const { data: d } = await supabase.from("drills").select("*").eq("bottleneck_id", current.id).order("sort_order").order("created_at");
    drills = (d ?? []) as Drill[];
    if (drills.length) {
      const { data: l } = await supabase
        .from("drill_logs")
        .select("*")
        .in("drill_id", drills.map((x) => x.id))
        .gte("day", addDays(today, -30));
      logs = (l ?? []) as DrillLog[];
    }
  }

  return {
    entries: entryRows.map(normalizeEntry),
    bottlenecks,
    active,
    proposed,
    reflections: reflRows,
    drills,
    logs,
  };
}

export function normalizeEntry(e: DailyEntry): DailyEntry {
  return {
    ...e,
    order_volume: Number(e.order_volume),
    cash_collected: Number(e.cash_collected),
    commission_pct: Number(e.commission_pct),
  };
}

export function normalizeProfile(p: Profile): Profile {
  return {
    ...p,
    commission_pct: Number(p.commission_pct),
    assumed_close_pct: Number(p.assumed_close_pct),
    assumed_showup_pct: Number(p.assumed_showup_pct),
  };
}

export async function loadComments(supabase: SupabaseClient, bottleneckId: string) {
  const { data } = await supabase.from("comments").select("*").eq("bottleneck_id", bottleneckId).order("created_at");
  return (data ?? []) as Comment[];
}

export async function loadNames(supabase: SupabaseClient, ids: string[]): Promise<Record<string, Profile>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return {};
  const { data } = await supabase.from("profiles").select("*").in("id", unique);
  return Object.fromEntries(((data ?? []) as Profile[]).map((p) => [p.id, p]));
}

/** Tage seit Aktivierung (Tag 1 = Aktivierungstag) */
export function daysInBottleneck(b: Bottleneck, today: string): number | null {
  if (!b.activated_at) return null;
  const start = dayOf(b.activated_at);
  const [y1, m1, d1] = start.split("-").map(Number);
  const [y2, m2, d2] = today.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000) + 1;
}

/**
 * Supabase liefert pro Abfrage höchstens 1000 Zeilen. Diese Hilfe holt seitenweise alles.
 * build() muss bei jedem Aufruf eine neue, sortierte Abfrage liefern.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchAll<T>(build: () => any, pageSize = 1000, maxRows = 20000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error || !data) break;
    out.push(...(data as T[]));
    if (data.length < pageSize) break;
  }
  return out;
}
