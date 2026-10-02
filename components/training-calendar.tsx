import Link from "next/link";
import type { Drill, DrillLog } from "@/lib/types";
import { addDays, monthEnd, monthName } from "@/lib/dates";
import { IconChevron, IconChevronLeft } from "./icons";

const WD = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Kleiner Monatskalender: an welchen Tagen wurde trainiert? */
export function TrainingCalendar({
  month,
  today,
  drills,
  logs,
  start,
  end,
  hrefFor,
}: {
  month: string; // YYYY-MM-01
  today: string;
  drills: Drill[];
  logs: DrillLog[];
  start: string | null;
  end: string | null;
  hrefFor: (month: string) => string;
}) {
  const perDay = new Map<string, number>();
  const ids = new Set(drills.map((d) => d.id));
  for (const l of logs) if (ids.has(l.drill_id)) perDay.set(l.day, (perDay.get(l.day) ?? 0) + 1);
  const total = drills.length;

  const last = monthEnd(month);
  const firstDow = (new Date(month + "T00:00:00Z").getUTCDay() + 6) % 7;
  const days: (string | null)[] = Array.from({ length: firstDow }, () => null);
  for (let d = month; d <= last; d = addDays(d, 1)) days.push(d);
  while (days.length % 7) days.push(null);

  const trained = days.filter((d) => d && (perDay.get(d) ?? 0) > 0).length;

  // Serie: zusammenhängende Tage mit mindestens einem Drill, bis heute bzw. gestern
  let streak = 0;
  let cursor = (perDay.get(today) ?? 0) > 0 ? today : addDays(today, -1);
  while ((perDay.get(cursor) ?? 0) > 0) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  const prevMonth = addDays(month, -1).slice(0, 8) + "01";
  const nextMonth = addDays(last, 1);
  const canNext = nextMonth <= today;
  const year = month.slice(0, 4);

  return (
    <section className="card" style={{ padding: "24px 24px 22px", gap: 16 }}>
      <div className="row between">
        <h2 className="h3">{monthName(month)} {year !== today.slice(0, 4) ? year : ""}</h2>
        <div className="row" style={{ gap: 4 }}>
          <Link href={hrefFor(prevMonth.slice(0, 7))} className="cal-nav" aria-label="Vorheriger Monat"><IconChevronLeft width={14} height={14} /></Link>
          {canNext ? (
            <Link href={hrefFor(nextMonth.slice(0, 7))} className="cal-nav" aria-label="Nächster Monat"><IconChevron width={14} height={14} /></Link>
          ) : (
            <span className="cal-nav off" aria-hidden><IconChevron width={14} height={14} /></span>
          )}
        </div>
      </div>

      <div className="cal" role="grid" aria-label={`Trainingstage im ${monthName(month)}`}>
        {WD.map((w) => <span key={w} className="cal-wd">{w}</span>)}
        {days.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const n = perDay.get(d) ?? 0;
          const inPhase = start !== null && d >= start && (end === null || d <= end);
          const cls = [
            "cal-day",
            n > 0 && total > 0 && n >= total ? "full" : n > 0 ? "part" : "",
            n === 0 && inPhase && d < today ? "miss" : "",
            d > today ? "future" : "",
            d === today ? "today" : "",
          ].filter(Boolean).join(" ");
          const label = `${Number(d.slice(8))}. ${monthName(d)}: ${n > 0 ? `${n} von ${total} Drills` : d > today ? "noch offen" : "kein Drill"}${d === start ? " · Start des Engpasses" : ""}`;
          return (
            <span key={d} className={cls} title={label} aria-label={label}>
              {Number(d.slice(8))}
              {d === start && <i className="cal-start" />}
            </span>
          );
        })}
      </div>

      <div className="row between small" style={{ gap: 12, flexWrap: "wrap" }}>
        <span><b>{trained}</b> <span className="muted">Trainingstage</span></span>
        <span><b>{streak}</b> <span className="muted">{streak === 1 ? "Tag" : "Tage"} in Folge</span></span>
      </div>
      <div className="row small muted" style={{ gap: 14, flexWrap: "wrap" }}>
        <span className="row" style={{ gap: 6 }}><span className="cal-key full" />alle Drills</span>
        <span className="row" style={{ gap: 6 }}><span className="cal-key part" />teilweise</span>
        <span className="row" style={{ gap: 6 }}><span className="cal-key start" />Start</span>
      </div>
    </section>
  );
}
