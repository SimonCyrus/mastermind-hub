import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanDayEntry } from "./types";
import type { PlannerWeek } from "@/components/day-planner";
import { addDays, isoWeek, weekStart } from "./dates";

export const PLANNER_WEEKS = 4;

/** Montag der ersten angezeigten Woche aus ?woche=YYYY-MM-DD, sonst aktuelle Woche */
export function plannerStart(param: string | undefined, today: string): string {
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) return weekStart(param);
  return weekStart(today);
}

export async function loadPlanner(supabase: SupabaseClient, participantId: string, monday: string) {
  const end = addDays(monday, PLANNER_WEEKS * 7 - 1);
  const { data, error } = await supabase.from("plan_days").select("*").eq("participant_id", participantId).gte("day", monday).lte("day", end);
  const missingTable = !!error && (error.code === "42P01" || error.code === "PGRST205" || /plan_days/.test(error.message));
  const byDay = new Map(((data ?? []) as PlanDayEntry[]).map((r) => [r.day, r]));
  const weeks: PlannerWeek[] = [];
  for (let w = 0; w < PLANNER_WEEKS; w++) {
    const m = addDays(monday, w * 7);
    weeks.push({
      monday: m,
      kw: isoWeek(m),
      days: Array.from({ length: 7 }, (_, i) => {
        const day = addDays(m, i);
        const r = byDay.get(day);
        return r ? { day, focus: r.focus, method: r.method, done: r.done } : { day };
      }),
    });
  }
  return {
    weeks,
    missingTable,
    prev: addDays(monday, -PLANNER_WEEKS * 7),
    next: addDays(monday, PLANNER_WEEKS * 7),
  };
}
