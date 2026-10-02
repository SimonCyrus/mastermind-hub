// Aus dem freien Rhythmus-Text eines Drills ("Täglich", "Mi & Fr", "2× pro Woche" …)
// wird bestimmt, an welchen Wochentagen er im Trainingskalender steht.
// Wochentage: 0 = Montag … 6 = Sonntag.

const DAY_WORDS: [RegExp, number][] = [
  [/\bmo(ntag|ntags)?\b/, 0],
  [/\bdi(enstag|enstags)?\b/, 1],
  [/\bmi(ttwoch|ttwochs)?\b/, 2],
  [/\bdo(nnerstag|nnerstags)?\b/, 3],
  [/\bfr(eitag|eitags)?\b/, 4],
  [/\bsa(mstag|mstags)?\b/, 5],
  [/\bso(nntag|nntags)?\b/, 6],
];

const WORKDAYS = [0, 1, 2, 3, 4];
const SPREAD: Record<number, number[]> = { 1: [0], 2: [1, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: WORKDAYS, 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6] };

export type Schedule = { kind: "days"; days: number[] } | { kind: "once" };

export function parseCadence(text: string): Schedule {
  const t = ` ${text.toLowerCase().replace(/[.,;/&+]/g, " ")} `;
  if (/einmalig|einmal\b/.test(t)) return { kind: "once" };
  if (/täglich|jeden tag|7\s*[x×]/.test(t) && !/werktag/.test(t)) return { kind: "days", days: [0, 1, 2, 3, 4, 5, 6] };
  if (/werktag|wochentag|mo\s*[-–]\s*fr/.test(t)) return { kind: "days", days: WORKDAYS };

  // Bereich wie "Mo–Do"
  const range = t.match(/\b(mo|di|mi|do|fr|sa|so)\s*[-–]\s*(mo|di|mi|do|fr|sa|so)\b/);
  if (range) {
    const idx = ["mo", "di", "mi", "do", "fr", "sa", "so"];
    const a = idx.indexOf(range[1]);
    const b = idx.indexOf(range[2]);
    if (a <= b) return { kind: "days", days: Array.from({ length: b - a + 1 }, (_, i) => a + i) };
  }

  const named = DAY_WORDS.filter(([re]) => re.test(t)).map(([, d]) => d);
  if (named.length) return { kind: "days", days: [...new Set(named)].sort() };

  const times = t.match(/(\d)\s*[x×]\s*(pro|die|in der)?\s*woche/);
  if (times) return { kind: "days", days: SPREAD[Math.min(7, Math.max(1, Number(times[1])))] };

  // "Vor jedem Call", "Jeder Call", "Jede Buchung" oder unbekannt → Arbeitstage
  return { kind: "days", days: WORKDAYS };
}

/** Wochentag eines ISO-Datums, 0 = Montag */
export function weekdayIndex(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function isScheduled(cadence: string, day: string, startDay: string | null): boolean {
  const s = parseCadence(cadence);
  if (s.kind === "once") return startDay !== null && day === startDay;
  return s.days.includes(weekdayIndex(day));
}

export const WEEKDAY_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
