import type { Drill, DrillLog } from "./types";
import { addDays, weekStart, diffDays } from "./dates";
import { isScheduled } from "./schedule";

export interface PlanItem {
  drillId: string;
  title: string;
  done: boolean;
  scheduled: boolean;
}

export interface PlanDay {
  day: string;
  inPhase: boolean;
  isToday: boolean;
  isFuture: boolean;
  editable: boolean;
  items: PlanItem[];
}

export interface PlanWeek {
  index: number; // 1 = Woche, in der der Engpass gestartet ist
  days: PlanDay[];
}

/** Wochenraster für den Trainingskalender eines Engpasses */
export function buildPlan(opts: {
  drills: Drill[];
  logs: DrillLog[];
  start: string | null; // Aktivierungstag
  end: string | null; // Tag, an dem gelöst
  today: string;
  fromWeek: number;
  weeks: number;
  editable: boolean;
}): PlanWeek[] {
  const base = weekStart(opts.start ?? opts.today);
  const done = new Set(opts.logs.map((l) => `${l.drill_id}|${l.day}`));
  const out: PlanWeek[] = [];
  for (let w = opts.fromWeek; w < opts.fromWeek + opts.weeks; w++) {
    const monday = addDays(base, (w - 1) * 7);
    const days: PlanDay[] = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(monday, i);
      const phaseStart = opts.start ?? opts.today;
      const inPhase = day >= phaseStart && (opts.end === null || day <= opts.end);
      const items: PlanItem[] = [];
      for (const d of opts.drills) {
        const isDone = done.has(`${d.id}|${day}`);
        const scheduled = inPhase && isScheduled(d.cadence, day, opts.start);
        if (scheduled || isDone) items.push({ drillId: d.id, title: d.title, done: isDone, scheduled });
      }
      days.push({
        day,
        inPhase,
        isToday: day === opts.today,
        isFuture: day > opts.today,
        editable: opts.editable && inPhase && day <= opts.today && opts.start !== null,
        items,
      });
    }
    out.push({ index: w, days });
  }
  return out;
}

/** In welcher Woche (1-basiert) des Engpasses liegt "today"? */
export function currentWeekIndex(start: string | null, today: string): number {
  if (!start) return 1;
  return Math.floor(diffDays(weekStart(today), weekStart(start)) / 7) + 1;
}
