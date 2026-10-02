import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCadence, weekdayIndex, isScheduled } from "../lib/schedule";

const days = (t: string) => { const s = parseCadence(t); return s.kind === "days" ? s.days : "once"; };

test("Rhythmus-Texte werden zu Wochentagen", () => {
  assert.deepEqual(days("Täglich"), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(days("Mi & Fr"), [2, 4]);
  assert.deepEqual(days("Mo, Mi, Fr"), [0, 2, 4]);
  assert.deepEqual(days("Mo–Do"), [0, 1, 2, 3]);
  assert.deepEqual(days("werktags"), [0, 1, 2, 3, 4]);
  assert.deepEqual(days("2× pro Woche"), [1, 3]);
  assert.deepEqual(days("3x pro Woche"), [0, 2, 4]);
  assert.deepEqual(days("Vor jedem Call"), [0, 1, 2, 3, 4]);
  assert.deepEqual(days("Jede Buchung"), [0, 1, 2, 3, 4]);
  assert.deepEqual(days("Dienstags"), [1]);
  assert.equal(days("Einmalig"), "once");
  assert.deepEqual(days(""), [0, 1, 2, 3, 4]);
});

test("Wochentag und Planung", () => {
  assert.equal(weekdayIndex("2026-10-02"), 4); // Freitag
  assert.equal(isScheduled("Mi & Fr", "2026-10-02", null), true);
  assert.equal(isScheduled("Mi & Fr", "2026-10-01", null), false);
  assert.equal(isScheduled("Einmalig", "2026-09-18", "2026-09-18"), true);
  assert.equal(isScheduled("Einmalig", "2026-09-19", "2026-09-18"), false);
});
