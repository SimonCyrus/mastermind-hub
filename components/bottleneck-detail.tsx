import type { Bottleneck, Drill, DrillLog, Comment, Profile } from "@/lib/types";
import { addDays, dayOf, formatDayMonth, weekdayShort } from "@/lib/dates";
import { average, type ObjectionStat } from "@/lib/metrics";
import { dec1, pad2, shortName } from "@/lib/format";
import { daysInBottleneck } from "@/lib/data";
import { ScoreChart } from "./charts";
import { DrillList } from "./drill-list";
import { CommentThread, type CommentView } from "./comments";
import type { FormState } from "@/app/(app)/actions";

export function DrillGrid({ drills, logs, bottleneck, today }: { drills: Drill[]; logs: DrillLog[]; bottleneck: Bottleneck; today: string }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const start = bottleneck.activated_at ? dayOf(bottleneck.activated_at) : today;
  const done = new Set(logs.map((l) => `${l.drill_id}|${l.day}`));
  if (drills.length === 0) return null;
  return (
    <div className="table">
      <div className="thead" style={{ gridTemplateColumns: "minmax(0,1fr) 130px 80px 190px" }}>
        <span>Drill</span><span className="hide-mobile">Wann</span><span className="hide-mobile">Dauer</span><span>Letzte 7 Tage</span>
      </div>
      {drills.map((d) => (
        <div key={d.id} className="trow" style={{ gridTemplateColumns: "minmax(0,1fr) 130px 80px 190px", fontSize: 15 }}>
          <div className="stack" style={{ gap: 2 }}>
            <span className="strong">{d.title}</span>
            {d.description && <span className="small muted">{d.description}</span>}
          </div>
          <span className="hide-mobile" style={{ color: "var(--text-2)" }}>{d.cadence}</span>
          <span className="hide-mobile" style={{ color: "var(--text-2)" }}>{d.duration}</span>
          <div className="dots" aria-label="Erledigt an den letzten 7 Tagen">
            {days.map((day) => {
              const isDone = done.has(`${d.id}|${day}`);
              const cls = isDone ? "done" : day >= start && day < today ? "missed" : "";
              return <span key={day} className={`dot ${cls}`} title={`${weekdayShort(day)} ${formatDayMonth(day)}${isDone ? ": erledigt" : ""}`} />;
            })}
          </div>
        </div>
      ))}
      <div className="row small muted" style={{ gap: 18, paddingTop: 12, flexWrap: "wrap" }}>
        <span className="row" style={{ gap: 6 }}><span className="dot done" style={{ width: 10, height: 10, borderRadius: 3 }} />erledigt</span>
        <span className="row" style={{ gap: 6 }}><span className="dot missed" style={{ width: 10, height: 10, borderRadius: 3 }} />nicht erledigt</span>
        <span className="row" style={{ gap: 6 }}><span className="dot" style={{ width: 10, height: 10, borderRadius: 3 }} />vor dem Start / heute offen</span>
      </div>
    </div>
  );
}

export function BottleneckSections({ bottleneck, drills, logs, today, scores, interactive, objections }: {
  bottleneck: Bottleneck;
  drills: Drill[];
  logs: DrillLog[];
  today: string;
  scores: number[];
  interactive: boolean;
  objections?: ObjectionStat[];
}) {
  const doneToday = new Set(logs.filter((l) => l.day === today).map((l) => l.drill_id));
  const avg = average(scores.slice(-10));
  const target = bottleneck.target_score !== null ? Number(bottleneck.target_score) : null;
  return (
    <>
      <section className="card">
        <div className="row" style={{ alignItems: "baseline", gap: 12 }}><span className="small strong" style={{ color: "var(--faint)" }}>01</span><h2 className="h2" style={{ fontSize: 22 }}>Warum dieser Engpass, warum jetzt</h2></div>
        <p style={{ fontSize: 17, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{bottleneck.why || <span className="muted">Die Diagnose ergänzt dein Coach.</span>}</p>
        {bottleneck.evidence?.length > 0 && (
          <div className="stack" style={{ gap: 0, borderTop: "1px solid var(--line)" }}>
            {bottleneck.evidence.map((e, i) => (
              <div key={i} className="row between" style={{ padding: "14px 0", borderBottom: i < bottleneck.evidence.length - 1 ? "1px solid var(--line)" : 0, fontSize: 15, gap: 16 }}>
                <span>{e.text}</span>
                {e.source && <span className="small muted" style={{ flexShrink: 0 }}>{e.source}</span>}
              </div>
            ))}
          </div>
        )}
        {objections && objections.length > 0 && (
          <span className="small muted">Einwände zuletzt: {objections.slice(0, 3).map((o) => `${o.label} ${o.solved}/${o.occurred}`).join(" · ")}</span>
        )}
      </section>

      <section className="card">
        <div className="row" style={{ alignItems: "baseline", gap: 12 }}><span className="small strong" style={{ color: "var(--faint)" }}>02</span><h2 className="h2" style={{ fontSize: 22 }}>So trainierst du</h2></div>
        {interactive && bottleneck.status === "active" && drills.length > 0 && (
          <div className="soft-panel">
            <DrillList
              drills={drills.map((d) => ({ id: d.id, title: d.title, meta: [d.cadence, d.duration].filter((x) => x && x !== "–").join(" · "), done: doneToday.has(d.id) }))}
              day={today}
              interactive
            />
          </div>
        )}
        {drills.length === 0 ? <span className="sub">Die Drills legt ihr im nächsten Coaching-Call fest.</span> : <DrillGrid drills={drills} logs={logs} bottleneck={bottleneck} today={today} />}
      </section>

      <section className="card">
        <div className="row" style={{ alignItems: "baseline", gap: 12 }}><span className="small strong" style={{ color: "var(--faint)" }}>03</span><h2 className="h2" style={{ fontSize: 22 }}>Woran wir messen und wann er gelöst ist</h2></div>
        <div className="grid-2" style={{ gap: 32 }}>
          <div className="stack sm">
            <span className="sub">{bottleneck.metric_label || "Messgröße"}{avg !== null ? ` · Ø letzte 10: ${dec1(avg)}` : ""}</span>
            <ScoreChart scores={scores} target={target} />
          </div>
          <div className="stack">
            <span className="sub">Abschlusskriterium{bottleneck.criteria?.length > 1 ? ", alle nötig" : ""}</span>
            {(bottleneck.criteria ?? []).length === 0 && <span className="sub">Legt ihr gemeinsam fest.</span>}
            {(bottleneck.criteria ?? []).map((c, i) => (
              <div key={i} className="row" style={{ gap: 12, fontSize: 15 }}>
                <span className={`check ${c.done ? "done" : "open"}`}>{c.done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}</span>
                <span>{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export function BottleneckHeader({ bottleneck, today }: { bottleneck: Bottleneck; today: string }) {
  const d = daysInBottleneck(bottleneck, today);
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <span className="eyebrow">
          Engpass {pad2(bottleneck.seq)} · {bottleneck.status === "active" ? "Aktiv" : bottleneck.status === "proposed" ? "Vorschlag" : bottleneck.status === "solved" ? "Gelöst" : "Verworfen"}
        </span>
        {bottleneck.status === "active" && d !== null && <span className="pill outline">Tag {d} · läuft, bis gelöst</span>}
        {bottleneck.status === "proposed" && <span className="pill blue">Wartet auf Freigabe durch den Coach</span>}
      </div>
      <h1 className="h-hero" style={{ fontSize: 48 }}>{bottleneck.title}</h1>
    </div>
  );
}

export function AgreementCard({ bottleneck, names }: { bottleneck: Bottleneck; names: Record<string, Profile> }) {
  const proposer = bottleneck.proposed_by ? names[bottleneck.proposed_by] : null;
  const activator = bottleneck.activated_by ? names[bottleneck.activated_by] : null;
  return (
    <section className="card" style={{ padding: "24px 26px", gap: 16 }}>
      <h2 className="h3">Gemeinsam festgelegt</h2>
      <div className="row" style={{ gap: 12 }}>
        <span className="avatar">{proposer ? proposer.full_name.slice(0, 1).toUpperCase() : "?"}</span>
        <div className="stack" style={{ gap: 1 }}>
          <span className="strong" style={{ fontSize: 14 }}>Vorgeschlagen von {proposer ? shortName(proposer.full_name) : "–"}</span>
          <span className="small muted">{formatDayMonth(dayOf(bottleneck.proposed_at))}</span>
        </div>
      </div>
      <div className="row" style={{ gap: 12 }}>
        <span className="avatar ink">{activator ? activator.full_name.slice(0, 1).toUpperCase() : "·"}</span>
        <div className="stack" style={{ gap: 1 }}>
          <span className="strong" style={{ fontSize: 14 }}>{activator ? `Aktiviert von ${shortName(activator.full_name)}` : "Noch nicht aktiviert"}</span>
          <span className="small muted">{bottleneck.activated_at ? formatDayMonth(dayOf(bottleneck.activated_at)) : "Im nächsten Coaching-Call"}</span>
        </div>
      </div>
    </section>
  );
}

export function commentViews(comments: Comment[], names: Record<string, Profile>, me: string): CommentView[] {
  return comments.map((c) => ({
    id: c.id,
    author: names[c.author_id] ? shortName(names[c.author_id].full_name) : "Unbekannt",
    mine: c.author_id === me,
    when: new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: process.env.NEXT_PUBLIC_APP_TIMEZONE || "Europe/Berlin" }).format(new Date(c.created_at)),
    body: c.body,
  }));
}

export function CommentsCard({ comments, action, placeholder }: { comments: CommentView[]; action: (s: FormState, fd: FormData) => Promise<FormState>; placeholder: string }) {
  return (
    <section className="card" style={{ padding: "24px 26px" }}>
      <h2 className="h3">Austausch zum Engpass</h2>
      <CommentThread comments={comments} action={action} placeholder={placeholder} />
    </section>
  );
}
