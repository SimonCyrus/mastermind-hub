import { test } from "node:test";
import assert from "node:assert/strict";
import { sumEntries, rates, planGoal, weeklySeries, objectionStats, weakestObjection, callsHeld } from "../lib/metrics";
import { isoWeek, weekStart, monthEnd, addDays } from "../lib/dates";
import type { DailyEntry, CallReflection } from "../lib/types";

function entry(day: string, p: Partial<DailyEntry>): DailyEntry {
  return {
    participant_id: "a", day, dials: 0, pickups: 0, conversations: 0, booked_outbound: 0, calendar_calls: 0,
    no_shows: 0, reschedules: 0, cancellations: 0, deposits: 0, one_call_closes: 0, followup_sales: 0,
    upsell_conversations: 0, upsells: 0, order_volume: 0, cash_collected: 0, commission_pct: 10, ...p,
  };
}

test("Formeln wie im Sheet", () => {
  const e = [
    entry("2026-09-28", { dials: 100, pickups: 34, conversations: 20, booked_outbound: 5, calendar_calls: 10, no_shows: 1, reschedules: 1, cancellations: 0, one_call_closes: 2, followup_sales: 1, upsell_conversations: 2, upsells: 1, order_volume: 10000, cash_collected: 8000 }),
  ];
  const t = sumEntries(e);
  const r = rates(t, 40);
  assert.equal(t.calls_held, 8); // = Kalender − (No-Show + Reschedule + Absage)
  assert.equal(t.total_sales, 4); // One-Call + Follow-up + Upsell
  assert.equal(r.pickupRate, 0.34);
  assert.equal(r.triageRate, 0.25);
  assert.equal(r.showupRate, 0.8);
  assert.equal(r.utilization, 0.2);
  assert.equal(r.oneCallCloseRate, 0.25);
  assert.equal(r.followupCloseRate, 0.125);
  assert.equal(r.upsellCloseRate, 0.5);
  assert.equal(r.totalCloseRate, 0.4); // 4 / (8 + 2)
  assert.equal(r.cashCollectionRate, 0.8);
  assert.equal(r.avgCashPerSale, 2000);
  assert.equal(t.commission, 800);
});

test("Provision nutzt hinterlegten Prozentsatz pro Tag", () => {
  const t = sumEntries([entry("2026-09-01", { cash_collected: 1000, commission_pct: 15 }), entry("2026-09-02", { cash_collected: 1000, commission_pct: 10 })]);
  assert.equal(t.commission, 250);
});

test("Geführte Calls werden nicht negativ, leere Quoten sind null", () => {
  assert.equal(callsHeld({ calendar_calls: 1, no_shows: 2, reschedules: 0, cancellations: 0 }), 0);
  assert.equal(rates(sumEntries([])).totalCloseRate, null);
});

test("Zielrechner wie im Sheet (10.000 € / 10 % / 2.800 € / 80 % / 60 %)", () => {
  const p = planGoal({ commissionGoal: 10000, commissionPct: 10, avgCashPerSale: 2800, showupPct: 80, closePct: 60 });
  assert.equal(p.cash, 100000);
  assert.ok(Math.abs(p.sales - 35.714) < 0.01);
  assert.ok(Math.abs(p.callsHeld - 59.52) < 0.01);
  assert.ok(Math.abs(p.callsBooked - 74.4) < 0.01);
  assert.equal(p.perWeek.cash, 25000);
});

test("Datumshilfen", () => {
  assert.equal(isoWeek("2026-09-28"), 40);
  assert.equal(isoWeek("2026-01-01"), 1);
  assert.equal(weekStart("2026-10-01"), "2026-09-28");
  assert.equal(monthEnd("2026-02-10"), "2026-02-28");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("Wochenverlauf", () => {
  const s = weeklySeries([entry("2026-09-28", { calendar_calls: 4, one_call_closes: 1 })], "2026-09-29", 3);
  assert.equal(s.length, 3);
  assert.equal(s[2].weekStart, "2026-09-28");
  assert.equal(s[2].closeRate, 0.25);
  assert.equal(s[0].closeRate, null);
});

test("Einwand-Quoten und schwächster Einwand", () => {
  const refl = (objs: [string, boolean][]): CallReflection => ({
    id: "x", participant_id: "a", bottleneck_id: null, day: "2026-09-01", label: "", result: null, score: null,
    objections: objs.map(([type, solved]) => ({ type: type as never, solved })), what_worked: "", next_time: "", created_at: "",
  });
  const rs = [
    ...Array.from({ length: 5 }, (_, i) => refl([["angst_partner", i === 0]])),
    ...Array.from({ length: 4 }, () => refl([["zeit", true]])),
  ];
  const stats = objectionStats(rs);
  assert.equal(stats.find((s) => s.type === "angst_partner")!.rate, 0.2);
  assert.equal(weakestObjection(stats)!.type, "angst_partner");
});

test("Begrüßung nach Tageszeit (Berlin)", async () => {
  const { greeting } = await import("../lib/dates");
  assert.equal(greeting(new Date("2026-09-29T11:45:00Z"), "Europe/Berlin"), "Hallo");
  assert.equal(greeting(new Date("2026-09-29T06:00:00Z"), "Europe/Berlin"), "Guten Morgen");
  assert.equal(greeting(new Date("2026-09-29T18:00:00Z"), "Europe/Berlin"), "Guten Abend");
});
