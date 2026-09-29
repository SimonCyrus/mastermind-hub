import Link from "next/link";
import type { Bottleneck, DailyEntry, Drill, DrillLog, Profile } from "@/lib/types";
import { type Totals, type Rates, type ObjectionStat, phaseImpact, average } from "@/lib/metrics";
import { euro, int, pct, ppDelta, dec1, pad2 } from "@/lib/format";
import { dayOf, formatDayMonth, monthName } from "@/lib/dates";
import { daysInBottleneck } from "@/lib/data";
import { DrillList } from "./drill-list";
import { ScoreBars } from "./charts";
import { IconChevron } from "./icons";

// ---------------------------------------------------------------------
// Engpass-Karte (Herzstück)
// ---------------------------------------------------------------------
export function BottleneckHero({
  bottleneck,
  drills,
  logs,
  today,
  scores,
  interactive,
  coachName,
  detailHref,
}: {
  bottleneck: Bottleneck | null;
  drills: Drill[];
  logs: DrillLog[];
  today: string;
  scores: number[];
  interactive: boolean;
  coachName?: string;
  detailHref?: string;
}) {
  if (!bottleneck) {
    return (
      <section className="card hero">
        <div className="stack sm">
          <span className="eyebrow">Aktueller Engpass</span>
          <h2 className="h-hero">Noch kein Engpass festgelegt</h2>
          <p className="sub" style={{ fontSize: 16 }}>
            {interactive
              ? "Schlag deinem Coach vor, woran du als Nächstes arbeiten willst. Ihr legt ihn dann gemeinsam fest."
              : "Leg im nächsten Call gemeinsam den ersten Engpass fest."}
          </p>
        </div>
        {interactive && (
          <div>
            <Link className="btn btn-primary" href="/engpass">Engpass vorschlagen</Link>
          </div>
        )}
      </section>
    );
  }

  const isActive = bottleneck.status === "active";
  const day = daysInBottleneck(bottleneck, today);
  const doneToday = new Set(logs.filter((l) => l.day === today).map((l) => l.drill_id));
  const avg = average(scores.slice(-10));
  const criteria = bottleneck.criteria || [];
  const drillItems = drills.map((d) => ({
    id: d.id,
    title: d.title,
    meta: [d.cadence, d.duration && d.duration !== "–" ? d.duration : "", d.description].filter(Boolean).join(" · "),
    done: doneToday.has(d.id),
  }));

  return (
    <section className="card hero">
      <div className="card-head">
        <div style={{ gap: 10 }}>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <span className="eyebrow">{isActive ? "Aktueller Engpass" : "Engpass-Vorschlag"}</span>
            {isActive && day !== null && <span className="pill">Tag {day}</span>}
            {!isActive && <span className="pill blue">Wartet auf Freigabe</span>}
          </div>
          <h2 className="h-hero">{bottleneck.title}</h2>
          <span className="sub" style={{ fontSize: 15 }}>
            Engpass {pad2(bottleneck.seq)}
            {isActive && bottleneck.activated_at
              ? ` · gemeinsam festgelegt${coachName ? ` mit ${coachName}` : ""} am ${formatDayMonth(dayOf(bottleneck.activated_at))}`
              : " · wird im nächsten Coaching-Call gemeinsam festgelegt"}
          </span>
        </div>
        {detailHref && (
          <Link href={detailHref} className="row hide-mobile" style={{ gap: 4, fontSize: 14, fontWeight: 600, flexShrink: 0 }}>
            Ganzer Trainingsplan <IconChevron width={14} height={14} />
          </Link>
        )}
      </div>

      <div className="cols-3">
        <div>
          <span className="label">Warum gerade jetzt</span>
          <p style={{ fontSize: 16, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
            {bottleneck.why || <span className="muted">Die Diagnose ergänzt dein Coach im nächsten Call.</span>}
          </p>
          {bottleneck.evidence?.length > 0 && (
            <span className="small muted">Grundlage: {bottleneck.evidence.map((e) => e.source || e.text).slice(0, 2).join(" · ")}</span>
          )}
        </div>
        <div>
          <DrillList drills={drillItems} day={today} interactive={interactive && isActive} />
        </div>
        <div>
          <span className="label">Fortschritt</span>
          {bottleneck.metric_label ? (
            <>
              <div className="row" style={{ alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1 }}>{avg !== null ? dec1(avg) : "–"}</span>
                <span className="sub" style={{ fontSize: 15 }}>
                  Ø {bottleneck.metric_label.replace(/\s*\(.*\)$/, "")}
                  {bottleneck.target_score !== null ? ` · Ziel ${dec1(Number(bottleneck.target_score))}` : ""}
                </span>
              </div>
              <ScoreBars scores={scores} target={bottleneck.target_score !== null ? Number(bottleneck.target_score) : null} />
            </>
          ) : (
            <span className="sub">Die Messgröße legt ihr gemeinsam fest.</span>
          )}
          {criteria.length > 0 && (
            <div className="stack sm" style={{ fontSize: 14 }}>
              {criteria.map((c, i) => (
                <div key={i} className="row between" style={{ gap: 12 }}>
                  <span>{c.label}</span>
                  <span className={c.done ? "good strong" : "muted"} style={{ flexShrink: 0 }}>{c.done ? "erfüllt" : "offen"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// KPI-Kacheln
// ---------------------------------------------------------------------
export function KpiTiles({
  profile,
  month,
  monthRates,
  prevRates,
  today,
}: {
  profile: Profile;
  month: Totals;
  monthRates: Rates;
  prevRates: Rates;
  today: string;
}) {
  const goal = profile.commission_goal;
  const progress = goal > 0 ? Math.min(1, month.commission / goal) : 0;
  const closeDelta = ppDelta(monthRates.totalCloseRate, prevRates.totalCloseRate);
  const showDelta = ppDelta(monthRates.showupRate, prevRates.showupRate);
  const deltaClass = (d: ReturnType<typeof ppDelta>) => (!d ? "muted" : d.sign > 0 ? "good" : d.sign < 0 ? "warn" : "muted");
  return (
    <section className="grid-4">
      <div className="card tight">
        <span className="label">Provision {monthName(today)}</span>
        <span className="big-num">{euro(month.commission)}</span>
        <div className="bar accent"><div style={{ width: `${progress * 100}%` }} /></div>
        <span className="small muted">{goal > 0 ? `${pct(month.commission / goal)} von ${euro(goal)} Ziel` : "Kein Ziel hinterlegt"}</span>
      </div>
      <div className="card tight">
        <span className="label">Gesamt-Closing-Rate</span>
        <span className="big-num">{pct(monthRates.totalCloseRate)}</span>
        <span className={`small strong ${deltaClass(closeDelta)}`}>{closeDelta ? `${closeDelta.text} ggü. Vormonat` : "Noch kein Vergleich"}</span>
        <span className="small muted">One-Call {pct(monthRates.oneCallCloseRate)} · Follow-up {pct(monthRates.followupCloseRate)}</span>
      </div>
      <div className="card tight">
        <span className="label">Showup-Rate</span>
        <span className="big-num">{pct(monthRates.showupRate)}</span>
        <span className={`small strong ${deltaClass(showDelta)}`}>{showDelta ? `${showDelta.text} ggü. Vormonat` : "Noch kein Vergleich"}</span>
        <span className="small muted">{int(month.calls_held)} von {int(month.calendar_calls)} Calls geführt</span>
      </div>
      <div className="card tight">
        <span className="label">Cash collected</span>
        <span className="big-num">{euro(month.cash_collected)}</span>
        <span className="small strong muted">Collection-Rate {pct(monthRates.cashCollectionRate)}</span>
        <span className="small muted">{int(month.total_sales)} Sales · Ø {monthRates.avgCashPerSale !== null ? euro(monthRates.avgCashPerSale) : "–"}</span>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Funnel
// ---------------------------------------------------------------------
export function FunnelCard({ t, r, salesRole, today }: { t: Totals; r: Rates; salesRole: Profile["sales_role"]; today: string }) {
  const rows: { label: string; value: string; rate: number | null; accent?: boolean }[] = [];
  if (salesRole !== "closer") {
    rows.push({ label: "Anwahlversuche", value: int(t.dials), rate: t.dials > 0 ? 1 : null });
    rows.push({ label: "Pickups", value: int(t.pickups), rate: r.pickupRate });
    rows.push({ label: "Gespräche 30 Sek.+", value: int(t.conversations), rate: t.pickups > 0 ? t.conversations / t.pickups : null });
    rows.push({ label: "Calls gebucht", value: int(t.booked_outbound), rate: r.triageRate });
  }
  rows.push({ label: "Calls im Kalender", value: int(t.calendar_calls), rate: salesRole === "closer" ? (t.calendar_calls > 0 ? 1 : null) : null });
  rows.push({ label: "Calls geführt", value: int(t.calls_held), rate: r.showupRate });
  rows.push({ label: "Sales", value: int(t.total_sales), rate: r.totalCloseRate, accent: true });
  return (
    <div className="card" style={{ flex: "1 1 0" }}>
      <div className="stack sm">
        <h3 className="h2">Dein Funnel</h3>
        <span className="sub">{monthName(today)} · Quote zum vorherigen Schritt</span>
      </div>
      <div className="stack" style={{ gap: 14 }}>
        {rows.map((row, i) => (
          <div key={row.label} className="stack" style={{ gap: 6 }}>
            <div className="row between" style={{ fontSize: 14 }}>
              <span>{row.label}</span>
              <span>
                <span className="strong">{row.value}</span>
                {i > 0 && row.rate !== null && <span className="muted"> · {pct(row.rate)}</span>}
              </span>
            </div>
            <div className={`bar${row.accent ? " accent" : ""}`}>
              <div style={{ width: `${Math.min(1, row.rate ?? 0) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Einwände
// ---------------------------------------------------------------------
export function ObjectionCard({ stats, weakest, action }: { stats: ObjectionStat[]; weakest: ObjectionStat | null; action?: React.ReactNode }) {
  return (
    <div className="card" style={{ flex: "1 1 0" }}>
      <div className="stack sm">
        <h3 className="h2">Einwände: wie oft gelöst</h3>
        <span className="sub">Letzte 60 Tage · aus deinen Call-Reflexionen</span>
      </div>
      {stats.length === 0 ? (
        <p className="sub">Noch keine Einwände erfasst. Trag sie in der Call-Reflexion ein, dann siehst du hier, wo du stark bist.</p>
      ) : (
        <div className="stack">
          {stats.map((s) => {
            const weak = weakest?.type === s.type;
            return (
              <div key={s.type} className="hbar-row">
                <span className={weak ? "warn strong" : undefined}>{s.label}</span>
                <div className={`bar thick${weak ? " warn" : ""}`}><div style={{ width: `${(s.rate ?? 0) * 100}%` }} /></div>
                <span><b>{s.solved}</b><span className="muted"> / {s.occurred}</span></span>
              </div>
            );
          })}
        </div>
      )}
      {weakest && (
        <div className="callout">
          <span>
            <b>Möglicher nächster Engpass:</b> {weakest.label}. Kam {weakest.occurred}× vor, nur {pct(weakest.rate)} gelöst.
          </span>
          {action}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Engpass-Historie
// ---------------------------------------------------------------------
export function HistoryCard({ bottlenecks, entries, today }: { bottlenecks: Bottleneck[]; entries: DailyEntry[]; today: string }) {
  const items = [...bottlenecks].filter((b) => b.status !== "archived").sort((a, b) => b.seq - a.seq);
  return (
    <div className="card" style={{ flex: "1 1 0" }}>
      <div className="stack sm">
        <h3 className="h2">Engpass-Historie</h3>
        <span className="sub">Was gelöst wurde und was es gebracht hat</span>
      </div>
      {items.length === 0 ? (
        <p className="sub">Hier sammeln sich deine gelösten Engpässe.</p>
      ) : (
        <div className="stack" style={{ gap: 0 }}>
          {items.map((b, i) => {
            const impact = phaseImpact(entries, b, today);
            const d = daysInBottleneck(b, b.solved_at ? dayOf(b.solved_at) : today);
            const status =
              b.status === "active" ? <span className="small strong accent">Aktiv · Tag {d}</span>
              : b.status === "solved" ? <span className="small muted">Gelöst in {d} Tagen</span>
              : <span className="small muted">Vorschlag</span>;
            return (
              <div key={b.id} className="timeline-item">
                <div className="timeline-rail">
                  <span className={`node${b.status === "active" ? " active" : b.status === "proposed" ? " proposed" : ""}`} />
                  {i < items.length - 1 && <span className="line" />}
                </div>
                <div className="timeline-body" style={i === items.length - 1 ? { paddingBottom: 0 } : undefined}>
                  <div className="row between" style={{ gap: 12, alignItems: "baseline" }}>
                    <span style={{ fontSize: 16, fontWeight: 600 }}>{pad2(b.seq)} · {b.title}</span>
                    <span style={{ flexShrink: 0 }}>{status}</span>
                  </div>
                  {b.status !== "proposed" && (
                    <span className="sub">
                      Closing-Rate {b.status === "active" ? "seit Start" : ""}{" "}
                      <b style={{ color: "var(--text)" }}>{pct(impact.before)} → {pct(impact.after)}</b>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
