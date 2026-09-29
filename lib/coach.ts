import type { Bottleneck, CallReflection, DailyEntry, Profile } from "./types";
import { sumEntries, rates, inRange, scoresFor, average, phaseImpact } from "./metrics";
import { addDays, diffDays, monthStart, monthEnd, prevMonthStart, dayOf } from "./dates";
import { daysInBottleneck } from "./data";

export type Warning = { kind: "warn" | "blue"; text: string; detail: string; priority: number };

export interface ParticipantSummary {
  profile: Profile;
  current: Bottleneck | null;
  day: number | null;
  scores: number[];
  avgScore: number | null;
  monthClose: number | null;
  prevClose: number | null;
  commission: number;
  lastCheckin: string | null;
  warnings: Warning[];
}

export const STALE_DAYS = 3;
export const LONG_BOTTLENECK_DAYS = 21;

export function summarize(profile: Profile, entries: DailyEntry[], bottlenecks: Bottleneck[], reflections: CallReflection[], today: string): ParticipantSummary {
  const active = bottlenecks.find((b) => b.status === "active") ?? null;
  const proposed = bottlenecks.find((b) => b.status === "proposed") ?? null;
  const current = active ?? proposed;
  const day = active ? daysInBottleneck(active, today) : null;
  const scores = current ? scoresFor(reflections, current.id) : [];
  const avgScore = average(scores.slice(-10));
  const mStart = monthStart(today);
  const month = sumEntries(inRange(entries, mStart, monthEnd(today)));
  const prev = sumEntries(inRange(entries, prevMonthStart(today), addDays(mStart, -1)));
  const lastCheckin = entries.length ? entries.reduce((m, e) => (e.day > m ? e.day : m), entries[0].day) : null;

  const warnings: Warning[] = [];
  if (!profile.onboarded_at) {
    warnings.push({ kind: "blue", text: "Onboarding offen", detail: "Hat sich registriert, aber den Start noch nicht abgeschlossen", priority: 3 });
  } else {
    const since = lastCheckin ? diffDays(today, lastCheckin) : diffDays(today, dayOf(profile.onboarded_at));
    if (since >= STALE_DAYS) {
      warnings.push({ kind: "warn", text: lastCheckin ? `Trackt seit ${since} Tagen nicht` : "Hat noch nie getrackt", detail: lastCheckin ? `Letzter Check-in vor ${since} Tagen` : "Seit dem Onboarding keine Tageszahlen", priority: 1 });
    }
    if (active && day !== null && day >= LONG_BOTTLENECK_DAYS) {
      const recent = average(scores.slice(-5));
      const earlier = average(scores.slice(-10, -5));
      const stuck = recent === null || earlier === null || recent - earlier < 0.5;
      if (stuck) warnings.push({ kind: "warn", text: `Engpass stagniert · Tag ${day}`, detail: `${active.title}${recent !== null ? ` · Ø zuletzt ${recent.toFixed(1).replace(".", ",")}` : " · kaum Reflexionen"}`, priority: 2 });
    }
    const last7 = sumEntries(inRange(entries, addDays(today, -6), today));
    const prev7 = sumEntries(inRange(entries, addDays(today, -13), addDays(today, -7)));
    const s1 = rates(last7).showupRate, s0 = rates(prev7).showupRate;
    if (s1 !== null && s0 !== null && last7.calendar_calls >= 5 && prev7.calendar_calls >= 5 && s0 - s1 >= 0.15) {
      warnings.push({ kind: "warn", text: "Showup-Rate eingebrochen", detail: `Diese Woche ${Math.round(s1 * 100)} % statt ${Math.round(s0 * 100)} %`, priority: 2 });
    }
    const c1 = rates(last7).totalCloseRate, c0 = rates(prev7).totalCloseRate;
    if (c1 !== null && c0 !== null && last7.calls_held >= 5 && prev7.calls_held >= 5 && c0 - c1 >= 0.15) {
      warnings.push({ kind: "warn", text: "Closing-Rate eingebrochen", detail: `Diese Woche ${Math.round(c1 * 100)} % statt ${Math.round(c0 * 100)} %`, priority: 2 });
    }
    if (proposed) warnings.push({ kind: "blue", text: "Wartet auf Freigabe", detail: `Schlägt vor: „${proposed.title}“`, priority: 3 });
    if (!active && !proposed) warnings.push({ kind: "blue", text: "Kein Engpass aktiv", detail: "Nächsten Engpass gemeinsam festlegen", priority: 3 });
  }
  warnings.sort((a, b) => a.priority - b.priority);

  return {
    profile,
    current,
    day,
    scores,
    avgScore,
    monthClose: rates(month).totalCloseRate,
    prevClose: rates(prev).totalCloseRate,
    commission: month.commission,
    lastCheckin,
    warnings,
  };
}

export interface ProgramStats {
  solvedThisMonth: number;
  solvedLastMonth: number;
  avgDaysToSolve: number | null;
  avgImpact: number | null;
  solvedCount: number;
  byTitle: { title: string; count: number; impact: number | null; solved: number }[];
}

export function programStats(bottlenecks: Bottleneck[], entriesByParticipant: Map<string, DailyEntry[]>, today: string): ProgramStats {
  const mStart = monthStart(today);
  const pStart = prevMonthStart(today);
  const solved = bottlenecks.filter((b) => b.status === "solved" && b.solved_at && b.activated_at);
  const durations = solved.map((b) => daysInBottleneck(b, dayOf(b.solved_at!))!).filter((x) => x !== null);
  const impacts: number[] = [];
  const byTitle = new Map<string, { count: number; impacts: number[]; solved: number }>();
  for (const b of bottlenecks) {
    if (b.status === "archived") continue;
    const e = byTitle.get(b.title) ?? { count: 0, impacts: [], solved: 0 };
    e.count += 1;
    if (b.status === "solved" && b.activated_at) {
      e.solved += 1;
      const imp = phaseImpact(entriesByParticipant.get(b.participant_id) ?? [], b, today);
      if (imp.before !== null && imp.after !== null) {
        e.impacts.push(imp.after - imp.before);
        impacts.push(imp.after - imp.before);
      }
    }
    byTitle.set(b.title, e);
  }
  return {
    solvedThisMonth: solved.filter((b) => dayOf(b.solved_at!) >= mStart).length,
    solvedLastMonth: solved.filter((b) => dayOf(b.solved_at!) >= pStart && dayOf(b.solved_at!) < mStart).length,
    avgDaysToSolve: average(durations),
    avgImpact: average(impacts),
    solvedCount: solved.length,
    byTitle: [...byTitle.entries()]
      .map(([title, v]) => ({ title, count: v.count, impact: average(v.impacts), solved: v.solved }))
      .sort((a, b) => b.count - a.count),
  };
}
