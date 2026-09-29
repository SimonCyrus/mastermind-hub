// Kennzahlen – entsprechen den Formeln aus dem bisherigen Tracking-Sheet
// ("ERWEITERTE STATISTIKEN"), mit drei Korrekturen:
//  1. Provision nutzt den hinterlegten Prozentsatz (im Sheet fest 10 %).
//  2. Auslastung nutzt die Slots des Teilnehmers (im Sheet fest 40).
//  3. Geführte Calls werden nicht negativ.
import { DAILY_COUNT_FIELDS, type DailyCountField, type DailyEntry, type CallReflection, type ObjectionType, type Bottleneck } from "./types";
import { addDays, weekStart, dayOf } from "./dates";

export type Totals = Record<DailyCountField, number> & {
  order_volume: number;
  cash_collected: number;
  commission: number;
  calls_held: number;
  total_sales: number;
  days: number;
};

export function callsHeld(e: Pick<DailyEntry, "calendar_calls" | "no_shows" | "reschedules" | "cancellations">): number {
  return Math.max(0, e.calendar_calls - (e.no_shows + e.reschedules + e.cancellations));
}

export function emptyTotals(): Totals {
  const t = { order_volume: 0, cash_collected: 0, commission: 0, calls_held: 0, total_sales: 0, days: 0 } as Totals;
  for (const f of DAILY_COUNT_FIELDS) t[f] = 0;
  return t;
}

export function sumEntries(entries: DailyEntry[]): Totals {
  const t = emptyTotals();
  for (const e of entries) {
    for (const f of DAILY_COUNT_FIELDS) t[f] += Number(e[f]) || 0;
    const cash = Number(e.cash_collected) || 0;
    t.order_volume += Number(e.order_volume) || 0;
    t.cash_collected += cash;
    t.commission += (cash * (Number(e.commission_pct) || 0)) / 100;
    t.calls_held += callsHeld(e);
    t.days += 1;
  }
  t.total_sales = t.one_call_closes + t.followup_sales + t.upsells;
  return t;
}

const ratio = (a: number, b: number): number | null => (b > 0 ? a / b : null);

export interface Rates {
  pickupRate: number | null; // Pickups / Anwahlen
  triageRate: number | null; // gebucht (Outbound) / Gespräche 30s+
  showupRate: number | null; // geführt / im Kalender
  utilization: number | null; // geführt / Slots
  oneCallCloseRate: number | null; // One-Call-Closes / geführt
  followupCloseRate: number | null; // Follow-up-Sales / geführt
  upsellCloseRate: number | null; // Upsells / Upsell-Gespräche
  totalCloseRate: number | null; // Gesamt-Sales / (geführt + Upsell-Gespräche)
  cashCollectionRate: number | null; // Cash / Auftragsvolumen
  avgVolumePerSale: number | null;
  avgCashPerSale: number | null;
}

export function rates(t: Totals, slots?: number): Rates {
  return {
    pickupRate: ratio(t.pickups, t.dials),
    triageRate: ratio(t.booked_outbound, t.conversations),
    showupRate: ratio(t.calls_held, t.calendar_calls),
    utilization: slots ? ratio(t.calls_held, slots) : null,
    oneCallCloseRate: ratio(t.one_call_closes, t.calls_held),
    followupCloseRate: ratio(t.followup_sales, t.calls_held),
    upsellCloseRate: ratio(t.upsells, t.upsell_conversations),
    totalCloseRate: ratio(t.total_sales, t.calls_held + t.upsell_conversations),
    cashCollectionRate: ratio(t.cash_collected, t.order_volume),
    avgVolumePerSale: ratio(t.order_volume, t.total_sales),
    avgCashPerSale: ratio(t.cash_collected, t.total_sales),
  };
}

export function inRange(entries: DailyEntry[], from: string, to: string): DailyEntry[] {
  return entries.filter((e) => e.day >= from && e.day <= to);
}

// ---------------------------------------------------------------------
// Zielrechner (Sheet: "MONATLICHE ZIELE FESTLEGEN"), rückwärts gerechnet
// ---------------------------------------------------------------------
export interface GoalPlan {
  cash: number;
  sales: number;
  callsHeld: number;
  callsBooked: number;
  perWeek: { cash: number; sales: number; callsHeld: number; callsBooked: number };
}

export function planGoal(input: {
  commissionGoal: number;
  commissionPct: number;
  avgCashPerSale: number;
  showupPct: number;
  closePct: number;
}): GoalPlan {
  const cash = input.commissionPct > 0 ? input.commissionGoal / (input.commissionPct / 100) : 0;
  const sales = input.avgCashPerSale > 0 ? cash / input.avgCashPerSale : 0;
  const callsHeld = input.closePct > 0 ? sales / (input.closePct / 100) : 0;
  const callsBooked = input.showupPct > 0 ? callsHeld / (input.showupPct / 100) : 0;
  return {
    cash,
    sales,
    callsHeld,
    callsBooked,
    perWeek: { cash: cash / 4, sales: sales / 4, callsHeld: callsHeld / 4, callsBooked: callsBooked / 4 },
  };
}

// ---------------------------------------------------------------------
// Wochen-Verlauf der Gesamt-Closing-Rate
// ---------------------------------------------------------------------
export interface WeekPoint {
  weekStart: string;
  totals: Totals;
  closeRate: number | null;
}

export function weeklySeries(entries: DailyEntry[], today: string, weeks = 12): WeekPoint[] {
  const lastWeek = weekStart(today);
  const points: WeekPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = addDays(lastWeek, -7 * i);
    const we = addDays(ws, 6);
    const t = sumEntries(inRange(entries, ws, we));
    points.push({ weekStart: ws, totals: t, closeRate: rates(t).totalCloseRate });
  }
  return points;
}

// ---------------------------------------------------------------------
// Einwände (aus Call-Reflexionen)
// ---------------------------------------------------------------------
export const OBJECTION_LABELS: Record<ObjectionType, string> = {
  logistisch_geld: "Logistisch – Geld",
  logistisch_partner: "Logistisch – Partner",
  angst_geld: "Angst – Geld",
  angst_partner: "Angst – Partner",
  denke_drueber_nach: "Denke drüber nach",
  zeit: "Zeit",
  wert: "Wert",
};

export const OBJECTION_TYPES = Object.keys(OBJECTION_LABELS) as ObjectionType[];

/** Welche Vorlage passt, wenn dieser Einwand der Engpass ist */
export const OBJECTION_TEMPLATE: Record<ObjectionType, string> = {
  logistisch_geld: "einwand-geld",
  angst_geld: "einwand-geld",
  logistisch_partner: "einwand-partner",
  angst_partner: "einwand-partner",
  denke_drueber_nach: "pain",
  zeit: "frame",
  wert: "pain",
};

export interface ObjectionStat {
  type: ObjectionType;
  label: string;
  occurred: number;
  solved: number;
  rate: number | null;
}

export function objectionStats(reflections: CallReflection[]): ObjectionStat[] {
  const map = new Map<ObjectionType, { occurred: number; solved: number }>();
  for (const r of reflections) {
    for (const o of r.objections || []) {
      if (!OBJECTION_LABELS[o.type]) continue;
      const s = map.get(o.type) || { occurred: 0, solved: 0 };
      s.occurred += 1;
      if (o.solved) s.solved += 1;
      map.set(o.type, s);
    }
  }
  return OBJECTION_TYPES.filter((t) => map.has(t))
    .map((t) => {
      const s = map.get(t)!;
      return { type: t, label: OBJECTION_LABELS[t], occurred: s.occurred, solved: s.solved, rate: ratio(s.solved, s.occurred) };
    })
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
}

/** Schwächster Einwand mit genug Fällen → Kandidat für den nächsten Engpass */
export function weakestObjection(stats: ObjectionStat[], minCases = 5, maxRate = 0.5): ObjectionStat | null {
  const candidates = stats.filter((s) => s.occurred >= minCases && (s.rate ?? 0) < maxRate);
  if (candidates.length === 0) return null;
  return candidates.reduce((w, s) => ((s.rate ?? 0) < (w.rate ?? 0) ? s : w));
}

// ---------------------------------------------------------------------
// Engpass-Messgröße (Score aus Reflexionen)
// ---------------------------------------------------------------------
export function scoresFor(reflections: CallReflection[], bottleneckId: string): number[] {
  return reflections
    .filter((r) => r.bottleneck_id === bottleneckId && typeof r.score === "number")
    .sort((a, b) => (a.day + a.created_at < b.day + b.created_at ? -1 : 1))
    .map((r) => r.score as number);
}

export function average(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

/** Closing-Rate in den 14 Tagen vor Start und am Ende einer Engpass-Phase */
export function phaseImpact(entries: DailyEntry[], b: Bottleneck, today: string): { before: number | null; after: number | null } {
  if (!b.activated_at) return { before: null, after: null };
  const start = dayOf(b.activated_at);
  const end = b.solved_at ? dayOf(b.solved_at) : today;
  const before = rates(sumEntries(inRange(entries, addDays(start, -14), addDays(start, -1)))).totalCloseRate;
  const after = rates(sumEntries(inRange(entries, addDays(end, -13), end))).totalCloseRate;
  return { before, after };
}
