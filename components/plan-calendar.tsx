"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { toggleDrill } from "@/app/(app)/actions";
import type { PlanWeek } from "@/lib/plan";
import { IconCheck, IconChevron, IconChevronLeft } from "./icons";

const WD = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const WD_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

const dateLabel = (iso: string) => `${Number(iso.slice(8))}. ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

export function PlanCalendar({
  weeks,
  title,
  subtitle,
  prevHref,
  nextHref,
  rangeLabel,
  hint,
}: {
  weeks: PlanWeek[];
  title: string;
  subtitle: string;
  prevHref: string | null;
  nextHref: string | null;
  rangeLabel: string;
  hint?: string;
}) {
  const [, start] = useTransition();
  const [done, setDone] = useOptimistic(
    new Set(weeks.flatMap((w) => w.days.flatMap((d) => d.items.filter((i) => i.done).map((i) => `${i.drillId}|${d.day}`)))),
    (state, change: { key: string; done: boolean }) => {
      const next = new Set(state);
      if (change.done) next.add(change.key);
      else next.delete(change.key);
      return next;
    }
  );

  return (
    <section className="card plan" style={{ gap: 18 }}>
      <div className="card-head" style={{ flexWrap: "wrap" }}>
        <div>
          <span className="eyebrow">Trainingskalender</span>
          <h2 className="h2" style={{ fontSize: 22 }}>{title}</h2>
          <span className="sub">{subtitle}</span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {prevHref ? <Link href={prevHref} scroll={false} className="cal-nav" aria-label="Frühere Wochen"><IconChevronLeft width={14} height={14} /></Link> : <span className="cal-nav off" aria-hidden><IconChevronLeft width={14} height={14} /></span>}
          <span className="small strong" style={{ minWidth: 96, textAlign: "center" }}>{rangeLabel}</span>
          {nextHref ? <Link href={nextHref} scroll={false} className="cal-nav" aria-label="Spätere Wochen"><IconChevron width={14} height={14} /></Link> : <span className="cal-nav off" aria-hidden><IconChevron width={14} height={14} /></span>}
        </div>
      </div>

      <div className="plan-grid" role="table" aria-label="Trainingskalender">
        <div className="plan-head" role="row">
          <span />
          {WD_SHORT.map((d) => <span key={d} role="columnheader">{d}</span>)}
        </div>
        {weeks.map((w) => (
          <div key={w.index} className="plan-row" role="row">
            <div className="plan-week" role="rowheader"><span>Woche {w.index}</span></div>
            {w.days.map((d, i) => {
              const total = d.items.filter((it) => it.scheduled).length;
              const doneCount = d.items.filter((it) => done.has(`${it.drillId}|${d.day}`)).length;
              const complete = total > 0 && doneCount >= total;
              const cls = ["plan-cell", !d.inPhase ? "out" : "", d.isToday ? "today" : "", d.isFuture ? "future" : "", complete ? "complete" : ""].filter(Boolean).join(" ");
              return (
                <div key={d.day} className={cls} role="cell">
                  <div className="plan-date">
                    <span className="plan-wd">{WD[i]}</span>
                    <span>{dateLabel(d.day)}</span>
                    {d.isToday && <span className="plan-today">Heute</span>}
                  </div>
                  <div className="plan-items">
                  {d.inPhase && d.items.length === 0 && <span className="plan-free">Frei</span>}
                  {d.items.map((it) => {
                    const key = `${it.drillId}|${d.day}`;
                    const isDone = done.has(key);
                    const missed = !isDone && !d.isFuture && !d.isToday && it.scheduled;
                    const content = (
                      <>
                        <span className={`plan-check${isDone ? " done" : ""}`}>{isDone && <IconCheck width={9} height={9} stroke="#fff" />}</span>
                        <span className="plan-title">{it.title}</span>
                      </>
                    );
                    return d.editable ? (
                      <button
                        key={key}
                        type="button"
                        className={`plan-item${isDone ? " done" : ""}${missed ? " missed" : ""}`}
                        aria-pressed={isDone}
                        onClick={() =>
                          start(async () => {
                            setDone({ key, done: !isDone });
                            await toggleDrill(it.drillId, d.day, !isDone);
                          })
                        }
                      >
                        {content}
                      </button>
                    ) : (
                      <div key={key} className={`plan-item${isDone ? " done" : ""}${missed ? " missed" : ""}`}>{content}</div>
                    );
                  })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="row small muted" style={{ gap: 16, flexWrap: "wrap" }}>
        <span className="row" style={{ gap: 6 }}><span className="plan-check done" style={{ width: 12, height: 12 }} />erledigt</span>
        <span className="row" style={{ gap: 6 }}><span className="plan-check" style={{ width: 12, height: 12 }} />geplant</span>
        <span className="row" style={{ gap: 6 }}><span className="plan-key-complete" />Tag komplett</span>
        {hint && <span>{hint}</span>}
      </div>
    </section>
  );
}
