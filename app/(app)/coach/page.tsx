import Link from "next/link";
import { requireCoach } from "@/lib/auth";
import { fetchAll, normalizeEntry, normalizeProfile } from "@/lib/data";
import { summarize, programStats } from "@/lib/coach";
import type { Bottleneck, CallReflection, DailyEntry, Profile } from "@/lib/types";
import { todayISO, addDays, formatLongDate, relativeDay } from "@/lib/dates";
import { pct, ppDelta, shortName, initials, dec1, euro } from "@/lib/format";
import { Sparkline } from "@/components/charts";

export const metadata = { title: "Teilnehmer" };

const ROLE_LABEL = { setter: "Setter", closer: "Closer", both: "Setter & Closer" } as const;
const COLS = "minmax(170px,1.2fr) minmax(0,1.5fr) 56px 130px 110px 190px 100px";

export default async function CoachPage() {
  const { supabase } = await requireCoach();
  const today = todayISO();
  const since = addDays(today, -200);

  const [{ data: people }, bottlenecks, entries, reflections, settingsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("role", "participant").order("full_name"),
    fetchAll<Bottleneck>(() => supabase.from("bottlenecks").select("*").order("id")),
    fetchAll<DailyEntry>(() => supabase.from("daily_entries").select("*").gte("day", since).order("participant_id").order("day")),
    fetchAll<CallReflection>(() => supabase.from("call_reflections").select("id, participant_id, bottleneck_id, day, score, objections, created_at").gte("day", addDays(today, -120)).order("id")),
    supabase.from("app_settings").select("invite_code").single(),
  ]);
  const participants = ((people ?? []) as Profile[]).map(normalizeProfile);

  const byP = <T extends { participant_id: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) m.set(r.participant_id, [...(m.get(r.participant_id) ?? []), r]);
    return m;
  };
  const entriesBy = byP(entries.map(normalizeEntry));
  const bnBy = byP(bottlenecks);
  const reflBy = byP(reflections as CallReflection[]);

  const summaries = participants.map((p) => summarize(p, entriesBy.get(p.id) ?? [], bnBy.get(p.id) ?? [], reflBy.get(p.id) ?? [], today));
  const attention = summaries.filter((s) => s.warnings.length > 0).sort((a, b) => a.warnings[0].priority - b.warnings[0].priority);
  const warnCount = summaries.filter((s) => s.warnings.some((w) => w.kind === "warn")).length;
  const proposalCount = summaries.filter((s) => s.warnings.some((w) => w.text === "Wartet auf Freigabe")).length;
  const stats = programStats(bottlenecks, entriesBy, today);
  const maxCount = Math.max(1, ...stats.byTitle.map((t) => t.count));
  const withImpact = stats.byTitle.filter((t) => t.impact !== null).sort((a, b) => (b.impact ?? 0) - (a.impact ?? 0));
  const maxImpact = Math.max(0.01, ...withImpact.map((t) => Math.abs(t.impact ?? 0)));

  return (
    <>
      <header className="page-head">
        <div>
          <span className="sub" style={{ fontWeight: 500 }}>{formatLongDate(today)} · {participants.length} Teilnehmer</span>
          <h1 className="h1">Deine Teilnehmer</h1>
        </div>
        <span className="pill outline" style={{ fontSize: 13, padding: "8px 14px" }}>Einladungscode: <b>{settingsRes.data?.invite_code}</b></span>
      </header>

      <section className="grid-4">
        <div className="card tight">
          <span className="label">Brauchen dich jetzt</span>
          <span className="big-num" style={{ color: warnCount + proposalCount ? "var(--warn)" : undefined }}>{warnCount + proposalCount}</span>
          <span className="small muted">{warnCount} Warnsignale · {proposalCount} Vorschläge</span>
        </div>
        <div className="card tight">
          <span className="label">Engpässe gelöst diesen Monat</span>
          <span className="big-num">{stats.solvedThisMonth}</span>
          <span className="small muted">Vormonat: {stats.solvedLastMonth}</span>
        </div>
        <div className="card tight">
          <span className="label">Ø Dauer bis gelöst</span>
          <span className="big-num">{stats.avgDaysToSolve !== null ? `${Math.round(stats.avgDaysToSolve)} Tage` : "–"}</span>
          <span className="small muted">über {stats.solvedCount} gelöste Engpässe</span>
        </div>
        <div className="card tight">
          <span className="label">Ø Closing-Zuwachs je Engpass</span>
          <span className="big-num" style={{ color: stats.avgImpact !== null && stats.avgImpact > 0 ? "var(--good)" : undefined }}>
            {stats.avgImpact !== null ? `${stats.avgImpact >= 0 ? "+" : "−"}${dec1(Math.abs(stats.avgImpact * 100))} Pp.` : "–"}
          </span>
          <span className="small muted">14 Tage vor Start vs. letzte 14 Tage</span>
        </div>
      </section>

      {attention.length > 0 && (
        <section className="card" style={{ gap: 6, padding: "26px 30px" }}>
          <h2 className="h2" style={{ marginBottom: 8 }}>Braucht deine Aufmerksamkeit</h2>
          {attention.map((s) => {
            const w = s.warnings[0];
            return (
              <Link key={s.profile.id} href={`/coach/teilnehmer/${s.profile.id}`} className="row" style={{ padding: "14px 0", borderTop: "1px solid var(--line)", color: "var(--text)", flexWrap: "wrap" }}>
                <span className="avatar">{initials(s.profile.full_name)}</span>
                <div className="stack" style={{ gap: 2, flex: 1, minWidth: 200 }}>
                  <span className="strong">{shortName(s.profile.full_name)}</span>
                  <span className="small muted">{w.detail}{s.warnings.length > 1 ? ` · +${s.warnings.length - 1} weitere` : ""}</span>
                </div>
                <span className={`pill ${w.kind}`}>{w.text}</span>
                <span className="btn btn-soft btn-sm">Öffnen</span>
              </Link>
            );
          })}
        </section>
      )}

      <section className="card" style={{ padding: "26px 30px 12px" }}>
        <h2 className="h2">Alle Teilnehmer</h2>
        {participants.length === 0 ? (
          <div className="empty">
            <span className="h3">Noch keine Teilnehmer</span>
            <span className="sub">Schick deinen Teilnehmern den Link zur App und den Einladungscode <b>{settingsRes.data?.invite_code}</b>. Sie registrieren sich selbst und durchlaufen das Onboarding.</span>
          </div>
        ) : (
          <div className="table" style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 980 }}>
              <div className="thead" style={{ gridTemplateColumns: COLS }}>
                <span>Teilnehmer</span><span>Aktueller Engpass</span><span>Tag</span><span>Messgröße</span><span>Closing</span><span>Provision / Ziel</span><span>Check-in</span>
              </div>
              {summaries.map((s) => {
                const d = ppDelta(s.monthClose, s.prevClose);
                const goal = s.profile.commission_goal;
                const prog = goal > 0 ? s.commission / goal : 0;
                const stale = s.lastCheckin ? addDays(s.lastCheckin, 3) <= today : true;
                return (
                  <Link key={s.profile.id} href={`/coach/teilnehmer/${s.profile.id}`} className="trow" style={{ gridTemplateColumns: COLS }}>
                    <div className="stack" style={{ gap: 1 }}>
                      <span className="strong">{shortName(s.profile.full_name)}</span>
                      <span className="small muted">{ROLE_LABEL[s.profile.sales_role]}</span>
                    </div>
                    <span>
                      {s.current ? s.current.title : <span className="muted">–</span>}
                      {s.current?.status === "proposed" && <span className="pill blue" style={{ marginLeft: 8 }}>Vorschlag</span>}
                    </span>
                    <span className={s.day !== null && s.day >= 21 ? "warn strong" : undefined}>{s.day ?? "–"}</span>
                    <div className="row" style={{ gap: 8 }}>
                      <Sparkline values={s.scores.slice(-8)} color={s.scores.length > 1 && s.scores[s.scores.length - 1] > s.scores[0] ? "#0071e3" : "#8e8e93"} />
                      <span>{s.avgScore !== null ? dec1(s.avgScore) : ""}</span>
                    </div>
                    <span>
                      <b>{pct(s.monthClose)}</b>{" "}
                      {d && <span className={`small ${d.sign > 0 ? "good" : d.sign < 0 ? "warn" : "muted"}`}>{d.text.replace(" Pp.", "")}</span>}
                    </span>
                    <div className="row" style={{ gap: 10 }} title={`${euro(s.commission)} von ${euro(goal)}`}>
                      <div className={`bar${prog >= 1 ? " accent" : ""}`} style={{ flex: 1 }}><div style={{ width: `${Math.min(1, prog) * 100}%` }} /></div>
                      <span className="small" style={{ width: 44, textAlign: "right" }}>{goal > 0 ? pct(prog) : "–"}</span>
                    </div>
                    <span className={stale ? "warn strong small" : "muted small"}>{s.lastCheckin ? relativeDay(s.lastCheckin, today) : "nie"}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="split">
        <div className="card" style={{ flex: "1 1 0" }}>
          <div className="stack sm"><h2 className="h2">Häufigste Engpässe</h2><span className="sub">Alle Teilnehmer · Anzahl</span></div>
          {stats.byTitle.length === 0 && <span className="sub">Noch keine Engpässe angelegt.</span>}
          {stats.byTitle.slice(0, 8).map((t) => (
            <div key={t.title} className="hbar-row" style={{ gridTemplateColumns: "200px minmax(0,1fr) 36px" }}>
              <span>{t.title}</span>
              <div className="bar thick"><div style={{ width: `${(t.count / maxCount) * 100}%` }} /></div>
              <span className="strong">{t.count}</span>
            </div>
          ))}
        </div>
        <div className="card" style={{ flex: "1 1 0" }}>
          <div className="stack sm"><h2 className="h2">Was dein Coaching bewirkt</h2><span className="sub">Ø Closing-Zuwachs, wenn dieser Engpass gelöst wurde</span></div>
          {withImpact.length === 0 && <span className="sub">Sobald die ersten Engpässe gelöst sind, siehst du hier, welcher am meisten bringt. Das ist dein stärkstes Argument im Marketing.</span>}
          {withImpact.slice(0, 8).map((t) => (
            <div key={t.title} className="hbar-row" style={{ gridTemplateColumns: "200px minmax(0,1fr) 80px" }}>
              <span>{t.title}</span>
              <div className={`bar thick${(t.impact ?? 0) >= 0 ? " accent" : " warn"}`}><div style={{ width: `${(Math.abs(t.impact ?? 0) / maxImpact) * 100}%` }} /></div>
              <span className="strong">{(t.impact ?? 0) >= 0 ? "+" : "−"}{dec1(Math.abs((t.impact ?? 0) * 100))} Pp.</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
