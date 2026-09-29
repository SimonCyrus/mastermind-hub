// Alle Tage sind Kalendertage in der Zeitzone der Teilnehmer (ISO "YYYY-MM-DD").
export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "Europe/Berlin";

export function todayISO(now: Date = new Date(), tz: string = APP_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA liefert YYYY-MM-DD
}

function toUTC(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = toUTC(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUTC(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((toUTC(a).getTime() - toUTC(b).getTime()) / 86400000);
}

/** Montag der Woche, in der der Tag liegt */
export function weekStart(iso: string): string {
  const d = toUTC(iso);
  const dow = (d.getUTCDay() + 6) % 7; // Mo = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return fromUTC(d);
}

export function monthStart(iso: string): string {
  return iso.slice(0, 8) + "01";
}

export function monthEnd(iso: string): string {
  const d = toUTC(monthStart(iso));
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return fromUTC(d);
}

export function prevMonthStart(iso: string): string {
  const d = toUTC(monthStart(iso));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return fromUTC(d);
}

/** ISO-Kalenderwoche */
export function isoWeek(iso: string): number {
  const d = toUTC(iso);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
}

/** Datum eines Zeitstempels als Tag in App-Zeitzone */
export function dayOf(timestamp: string, tz: string = APP_TIMEZONE): string {
  return todayISO(new Date(timestamp), tz);
}

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const WEEKDAYS_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

export function formatLongDate(iso: string): string {
  const d = toUTC(iso);
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()]}`;
}

export function formatShortDate(iso: string): string {
  const d = toUTC(iso);
  return `${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;
}

export function formatDayMonth(iso: string): string {
  const d = toUTC(iso);
  return `${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()]}`;
}

export function weekdayShort(iso: string): string {
  return WEEKDAYS_SHORT[toUTC(iso).getUTCDay()];
}

export function monthName(iso: string): string {
  return MONTHS[toUTC(iso).getUTCMonth()];
}

export function relativeDay(iso: string, today: string): string {
  const d = diffDays(today, iso);
  if (d === 0) return "Heute";
  if (d === 1) return "Gestern";
  if (d < 0) return formatShortDate(iso);
  return `vor ${d} Tagen`;
}

export function greeting(now: Date = new Date(), tz: string = APP_TIMEZONE): string {
  const hourPart = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).formatToParts(now).find((p) => p.type === "hour");
  const h = Number(hourPart?.value ?? 12);
  if (h < 11) return "Guten Morgen";
  if (h < 18) return "Hallo";
  return "Guten Abend";
}
