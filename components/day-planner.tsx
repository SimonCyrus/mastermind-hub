"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { savePlanDay, togglePlanDone, type FormState } from "@/app/(app)/actions";
import { IconCheck, IconChevron, IconChevronLeft, IconPlusSmall } from "./icons";

export type PlannerDay = { day: string; focus: string; method: string; done: boolean } | { day: string; focus?: undefined; method?: undefined; done?: undefined };
export type PlannerWeek = { monday: string; kw: number; days: PlannerDay[] };

const WD = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const WD_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const MONTHS_LONG = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const short = (iso: string) => `${Number(iso.slice(8))}. ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
const long = (iso: string) => {
  const d = new Date(iso + "T00:00:00Z");
  return `${WD[(d.getUTCDay() + 6) % 7]}, ${d.getUTCDate()}. ${MONTHS_LONG[d.getUTCMonth()]}`;
};

function Editor({ participantId, day, entry, today, defaultFocus, suggestions, onClose }: {
  participantId: string;
  day: string;
  entry: PlannerDay;
  today: string;
  defaultFocus: string;
  suggestions: string[];
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePlanDay.bind(null, participantId), undefined);
  const firstRef = useRef<HTMLInputElement>(null);
  useEffect(() => { firstRef.current?.focus(); }, []);
  useEffect(() => { if (state?.ok) onClose(); }, [state, onClose]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const hasEntry = entry.focus !== undefined;
  const weekday = (new Date(day + "T00:00:00Z").getUTCDay() + 6) % 7;

  return (
    <div className="dp-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dp-dialog" role="dialog" aria-modal="true" aria-labelledby="dp-title">
        <form action={action} className="stack" style={{ gap: 16 }}>
          <input type="hidden" name="day" value={day} />
          <div className="stack" style={{ gap: 2 }}>
            <span className="eyebrow">Tagesplan</span>
            <h2 id="dp-title" className="h2">{long(day)}</h2>
          </div>
          <label className="field">
            <span>Engpass</span>
            <input ref={firstRef} className="input" name="focus" list="dp-suggestions" maxLength={120} defaultValue={hasEntry ? entry.focus : defaultFocus} placeholder="z. B. Menschlich rüberkommen" />
            <datalist id="dp-suggestions">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
          </label>
          <label className="field">
            <span>So wird trainiert</span>
            <textarea className="textarea" name="method" rows={5} maxLength={1000} defaultValue={hasEntry ? entry.method : ""} placeholder={"z. B. 15 Min Mimik im Zoom mit Kamera an,\n3 persönliche Fragen vor jedem Call vorbereiten"} />
          </label>
          {day <= today && (
            <label className="row small" style={{ gap: 8 }}>
              <input type="checkbox" name="done" value="1" defaultChecked={hasEntry ? entry.done : false} /> Erledigt
            </label>
          )}
          {weekday < 5 && (
            <label className="row small" style={{ gap: 8 }}>
              <input type="checkbox" name="apply_week" value="1" /> Für Mo–Fr dieser Woche übernehmen
            </label>
          )}
          {state?.error && <p className="form-error">{state.error}</p>}
          <div className="row between" style={{ gap: 10, flexWrap: "wrap" }}>
            {hasEntry ? (
              <button className="btn btn-danger btn-sm" type="submit" name="clear" value="1" disabled={pending}>Eintrag löschen</button>
            ) : <span />}
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-soft" type="button" onClick={onClose}>Abbrechen</button>
              <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Speichert …" : "Speichern"}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export function DayPlanner({
  weeks,
  participantId,
  today,
  defaultFocus,
  suggestions,
  prevHref,
  nextHref,
  todayHref,
  missingTable,
  title = "Trainingskalender",
  subtitle,
}: {
  weeks: PlannerWeek[];
  participantId: string;
  today: string;
  defaultFocus: string;
  suggestions: string[];
  prevHref: string;
  nextHref: string;
  todayHref: string | null;
  missingTable: boolean;
  title?: string;
  subtitle: string;
}) {
  const [open, setOpen] = useState<PlannerDay | null>(null);
  const [, start] = useTransition();
  const first = weeks[0]?.monday;
  const last = weeks[weeks.length - 1]?.days[6]?.day;

  return (
    <section className="card plan" style={{ gap: 18 }}>
      <div className="card-head" style={{ flexWrap: "wrap" }}>
        <div>
          <span className="eyebrow">Trainingskalender</span>
          <h2 className="h2" style={{ fontSize: 22 }}>{title}</h2>
          <span className="sub">{subtitle}</span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {todayHref && <Link href={todayHref} scroll={false} className="btn btn-soft btn-sm">Heute</Link>}
          <Link href={prevHref} scroll={false} className="cal-nav" aria-label="Frühere Wochen"><IconChevronLeft width={14} height={14} /></Link>
          <span className="small strong" style={{ minWidth: 120, textAlign: "center" }}>{first && last ? `${short(first)} – ${short(last)}` : ""}</span>
          <Link href={nextHref} scroll={false} className="cal-nav" aria-label="Spätere Wochen"><IconChevron width={14} height={14} /></Link>
        </div>
      </div>

      {missingTable && (
        <p className="form-error">Der Kalender braucht noch ein Datenbank-Update: Datei <b>supabase/updates/002_tagesplan.sql</b> einmal im Supabase SQL-Editor ausführen.</p>
      )}

      <div className="plan-grid" role="table" aria-label="Trainingskalender">
        <div className="plan-head" role="row">
          <span />
          {WD_SHORT.map((d) => <span key={d} role="columnheader">{d}</span>)}
        </div>
        {weeks.map((w) => (
          <div key={w.monday} className="plan-row" role="row">
            <div className={`plan-week${w.days.some((d) => d.day === today) ? " current" : ""}`} role="rowheader"><span>KW {w.kw}</span></div>
            {w.days.map((d, i) => {
              const has = d.focus !== undefined;
              const cls = ["plan-cell", "dp-cell", d.day === today ? "today" : "", d.day > today ? "future" : "", has && d.done ? "complete" : "", has ? "filled" : "empty"].filter(Boolean).join(" ");
              return (
                <div key={d.day} className={cls} role="cell">
                  <button type="button" className="dp-open" onClick={() => !missingTable && setOpen(d)} aria-label={`${long(d.day)} ${has ? "bearbeiten" : "eintragen"}`}>
                    <span className="plan-date">
                      <span className="plan-wd">{WD[i]}</span>
                      <span>{short(d.day)}</span>
                      {d.day === today && <span className="plan-today">Heute</span>}
                    </span>
                    {has ? (
                      <span className="dp-body">
                        {d.focus && <span className="dp-focus">{d.focus}</span>}
                        {d.method && <span className="dp-method">{d.method}</span>}
                      </span>
                    ) : (
                      <span className="dp-add"><IconPlusSmall width={12} height={12} /> Eintragen</span>
                    )}
                  </button>
                  {has && d.day <= today && (
                    <button
                      type="button"
                      className={`dp-done${d.done ? " on" : ""}`}
                      aria-pressed={d.done}
                      aria-label={d.done ? "Als offen markieren" : "Als erledigt markieren"}
                      title={d.done ? "Erledigt" : "Als erledigt markieren"}
                      onClick={() => start(() => togglePlanDone(participantId, d.day, !d.done))}
                    >
                      {d.done && <IconCheck width={10} height={10} stroke="#fff" />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="row small muted" style={{ gap: 16, flexWrap: "wrap" }}>
        <span>Tag anklicken, um Engpass und Training einzutragen.</span>
        <span className="row" style={{ gap: 6 }}><span className="plan-key-complete" />erledigt</span>
      </div>

      {open && (
        <Editor
          key={open.day}
          participantId={participantId}
          day={open.day}
          entry={open}
          today={today}
          defaultFocus={defaultFocus}
          suggestions={suggestions}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}
