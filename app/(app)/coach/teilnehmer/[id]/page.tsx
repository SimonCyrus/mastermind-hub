import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/auth";
import { loadParticipant, loadComments, loadNames, normalizeProfile } from "@/lib/data";
import { sumEntries, rates, inRange, weeklySeries, objectionStats, weakestObjection, scoresFor, planGoal } from "@/lib/metrics";
import { todayISO, monthStart, monthEnd, prevMonthStart, addDays, relativeDay } from "@/lib/dates";
import { int, euro, pad2 } from "@/lib/format";
import type { Bottleneck, BottleneckTemplate, Profile } from "@/lib/types";
import { BottleneckHero, KpiTiles, FunnelCard, ObjectionCard, HistoryCard } from "@/components/dashboard";
import { ClosingChart } from "@/components/charts";
import { DrillGrid, CommentsCard, commentViews } from "@/components/bottleneck-detail";
import { ActionForm, ActionButton } from "@/components/action-form";
import { CriteriaToggles, DrillEditor } from "@/components/coach-controls";
import { IconChevronLeft } from "@/components/icons";
import { addComment } from "../../../actions";
import {
  createBottleneck,
  updateBottleneck,
  activateBottleneck,
  solveBottleneck,
  archiveBottleneck,
  saveCoachNote,
} from "../../actions";

export const metadata = { title: "Teilnehmer" };

const ROLE_LABEL = { setter: "Setter", closer: "Closer", both: "Setter & Closer" } as const;

function EditForm({ b }: { b: Bottleneck }) {
  return (
    <ActionForm action={updateBottleneck.bind(null, b.id)} submit="Änderungen speichern" className="stack">
      <label className="field"><span>Titel</span><input className="input" name="title" defaultValue={b.title} required /></label>
      <label className="field"><span>Warum dieser Engpass, warum jetzt (Diagnose)</span><textarea className="textarea" name="why" rows={4} defaultValue={b.why} placeholder="Was hast du in den Calls gesehen? Warum ist das jetzt der Hebel?" /></label>
      <label className="field">
        <span>Belege, eine Zeile pro Beleg: Beobachtung | Quelle</span>
        <textarea className="textarea" name="evidence" rows={3} defaultValue={(b.evidence ?? []).map((e) => (e.source ? `${e.text} | ${e.source}` : e.text)).join("\n")} placeholder={"Opening wirkt in 4 von 5 Aufnahmen abgelesen | Call-Review KW 37"} />
      </label>
      <div className="grid-2" style={{ gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)" }}>
        <label className="field"><span>Messgröße</span><input className="input" name="metric_label" defaultValue={b.metric_label} placeholder="z. B. Rapport-Score (1–10)" /></label>
        <label className="field"><span>Zielwert (1–10)</span><input className="input" name="target_score" inputMode="decimal" defaultValue={b.target_score !== null ? String(b.target_score).replace(".", ",") : ""} placeholder="8" /></label>
      </div>
      <label className="field"><span>Frage nach jedem Call</span><input className="input" name="reflection_question" defaultValue={b.reflection_question} placeholder="Wie menschlich bist du rübergekommen?" /></label>
      <label className="field"><span>Abschlusskriterien, eins pro Zeile</span><textarea className="textarea" name="criteria" rows={3} defaultValue={(b.criteria ?? []).map((c) => c.label).join("\n")} /></label>
    </ActionForm>
  );
}

function StatusButtons({ b, hasActive }: { b: Bottleneck; hasActive: boolean }) {
  return (
    <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
      {b.status === "proposed" && !hasActive && <ActionButton action={activateBottleneck.bind(null, b.id)} label="Engpass aktivieren" className="btn btn-primary" />}
      {b.status === "proposed" && hasActive && <span className="small muted">Aktivierbar, sobald der aktuelle Engpass gelöst ist.</span>}
      {b.status === "active" && (
        <ActionButton action={solveBottleneck.bind(null, b.id)} label="Als gelöst markieren" className="btn btn-dark" confirm={`„${b.title}“ als gelöst markieren? Danach könnt ihr den nächsten Engpass aktivieren.`} />
      )}
      <ActionButton
        action={archiveBottleneck.bind(null, b.id)}
        label={b.status === "proposed" ? "Vorschlag verwerfen" : "Abbrechen"}
        className="btn btn-soft"
        confirm={b.status === "proposed" ? "Diesen Vorschlag verwerfen?" : "Engpass abbrechen, ohne ihn als gelöst zu werten?"}
      />
    </div>
  );
}

function ManageCard({ b, hasActive, drills, participantId }: { b: Bottleneck; hasActive: boolean; drills: import("@/lib/types").Drill[]; participantId: string }) {
  return (
    <section className="card" style={{ boxShadow: b.status === "active" ? "0 0 0 1.5px var(--accent)" : undefined }}>
      <div className="card-head" style={{ flexWrap: "wrap" }}>
        <div>
          <span className="eyebrow">{b.status === "active" ? "Aktiver Engpass bearbeiten" : "Vorschlag prüfen"} · {pad2(b.seq)}</span>
          <h2 className="h2" style={{ fontSize: 24 }}>{b.title}</h2>
        </div>
        <StatusButtons b={b} hasActive={hasActive} />
      </div>
      <div className="grid-2" style={{ gap: 32, alignItems: "start" }}>
        <div className="stack lg">
          <EditForm b={b} />
        </div>
        <div className="stack lg">
          <div className="stack sm">
            <span className="label">Abschlusskriterien</span>
            <CriteriaToggles bottleneckId={b.id} criteria={b.criteria ?? []} />
          </div>
          <div className="stack sm">
            <span className="label">Drills</span>
            <DrillEditor bottleneckId={b.id} participantId={participantId} drills={drills} />
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function ParticipantDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireCoach();
  const { data: raw } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle<Profile>();
  if (!raw || raw.role !== "participant") notFound();
  const profile = normalizeProfile(raw);
  const today = todayISO();
  const data = await loadParticipant(supabase, id, today);
  const current = data.active ?? data.proposed;

  // Drills des Vorschlags separat laden, falls es auch einen aktiven gibt
  let proposalDrills = data.active ? [] : data.drills;
  if (data.active && data.proposed) {
    const { data: pd } = await supabase.from("drills").select("*").eq("bottleneck_id", data.proposed.id).order("sort_order");
    proposalDrills = pd ?? [];
  }

  const [{ data: tpl }, { data: note }, comments] = await Promise.all([
    supabase.from("bottleneck_templates").select("id, name, category").order("sort_order"),
    supabase.from("coach_notes").select("body").eq("participant_id", id).maybeSingle(),
    current ? loadComments(supabase, current.id) : Promise.resolve([]),
  ]);
  const templates = (tpl ?? []) as Pick<BottleneckTemplate, "id" | "name" | "category">[];
  const names = await loadNames(supabase, [user.id, id, ...comments.map((c) => c.author_id)]);

  const mStart = monthStart(today);
  const month = sumEntries(inRange(data.entries, mStart, monthEnd(today)));
  const prev = sumEntries(inRange(data.entries, prevMonthStart(today), addDays(mStart, -1)));
  const stats = objectionStats(data.reflections.filter((r) => r.day >= addDays(today, -60)));
  const lastEntry = data.entries.length ? data.entries[data.entries.length - 1].day : null;
  const plan = planGoal({ commissionGoal: profile.commission_goal, commissionPct: profile.commission_pct, avgCashPerSale: profile.avg_cash_per_sale, showupPct: profile.assumed_showup_pct, closePct: profile.assumed_close_pct });
  const selfCheck = Object.entries(profile.self_check ?? {});
  const recentReflections = [...data.reflections].reverse().filter((r) => r.what_worked || r.next_time).slice(0, 4);

  return (
    <>
      <div>
        <Link href="/coach" className="row small strong" style={{ gap: 4 }}><IconChevronLeft width={14} height={14} /> Alle Teilnehmer</Link>
      </div>
      <header className="page-head">
        <div>
          <span className="sub">{ROLE_LABEL[profile.sales_role]} · Ziel {euro(profile.commission_goal)} Provision · letzter Check-in {lastEntry ? relativeDay(lastEntry, today).toLowerCase() : "nie"}</span>
          <h1 className="h1">{profile.full_name || "Ohne Namen"}</h1>
        </div>
      </header>

      {!profile.onboarded_at && <div className="callout blue"><span>{profile.full_name.split(" ")[0] || "Der Teilnehmer"} hat das Onboarding noch nicht abgeschlossen.</span></div>}

      <BottleneckHero bottleneck={current} drills={current === data.proposed && data.active ? proposalDrills : data.drills} logs={data.logs} today={today} scores={current ? scoresFor(data.reflections, current.id) : []} interactive={false} />

      {data.active && <ManageCard b={data.active} hasActive={false} drills={data.drills} participantId={id} />}
      {data.proposed && <ManageCard b={data.proposed} hasActive={!!data.active} drills={proposalDrills} participantId={id} />}

      {data.active && data.drills.length > 0 && (
        <section className="card">
          <h2 className="h2">Drills der letzten 7 Tage</h2>
          <DrillGrid drills={data.drills} logs={data.logs} bottleneck={data.active} today={today} />
        </section>
      )}

      {!data.proposed && (
        <section className="card">
          <div className="stack sm">
            <h2 className="h2">{data.active ? "Nächsten Engpass vorbereiten" : "Neuen Engpass anlegen"}</h2>
            <span className="sub">Aus der Bibliothek übernehmen und danach anpassen. {data.active ? "Er wird als Vorschlag gespeichert, bis der aktuelle gelöst ist." : ""}</span>
          </div>
          <ActionForm action={createBottleneck.bind(null, id)} submit="Anlegen" className="stack">
            <div className="grid-2">
              <label className="field">
                <span>Vorlage</span>
                <select className="select" name="template_id" defaultValue="">
                  <option value="">Leer beginnen</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.category}</option>)}
                </select>
              </label>
              <label className="field"><span>Eigener Titel (optional)</span><input className="input" name="title" /></label>
            </div>
            {!data.active && (
              <label className="row small" style={{ gap: 8 }}>
                <input type="checkbox" name="activate" value="1" defaultChecked /> Direkt aktivieren (ihr habt ihn gerade gemeinsam festgelegt)
              </label>
            )}
          </ActionForm>
        </section>
      )}

      <KpiTiles profile={profile} month={month} monthRates={rates(month, profile.weekly_slots * 4)} prevRates={rates(prev)} today={today} />

      <section className="split">
        <div className="card wide" style={{ flex: "2 1 0" }}>
          <div className="card-head"><div><h3 className="h2">Closing-Rate, Engpass für Engpass</h3><span className="sub">Letzte 12 Wochen</span></div></div>
          <ClosingChart series={weeklySeries(data.entries, today, 12)} bottlenecks={data.bottlenecks} today={today} />
        </div>
        <FunnelCard t={month} r={rates(month)} salesRole={profile.sales_role} today={today} />
      </section>

      <section className="split">
        <ObjectionCard stats={stats} weakest={weakestObjection(stats)} />
        <HistoryCard bottlenecks={data.bottlenecks} entries={data.entries} today={today} />
      </section>

      <section className="split">
        <div className="wide">
          {current ? (
            <CommentsCard comments={commentViews(comments, names, user.id)} action={addComment.bind(null, current.id)} placeholder={`Nachricht an ${profile.full_name.split(" ")[0] || "den Teilnehmer"}`} />
          ) : (
            <section className="card"><h2 className="h3">Austausch zum Engpass</h2><span className="sub">Sobald ein Engpass angelegt ist, könnt ihr euch hier austauschen.</span></section>
          )}
          {recentReflections.length > 0 && (
            <section className="card">
              <h2 className="h3">Letzte Reflexionen</h2>
              {recentReflections.map((r) => (
                <div key={r.id} className="stack sm" style={{ paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                  <span className="small muted">{relativeDay(r.day, today)}{r.label ? ` · ${r.label}` : ""}{r.score ? ` · ${r.score}/10` : ""}</span>
                  {r.what_worked && <span><b>Hat funktioniert:</b> {r.what_worked}</span>}
                  {r.next_time && <span><b>Nächstes Mal:</b> {r.next_time}</span>}
                </div>
              ))}
            </section>
          )}
        </div>
        <aside className="narrow">
          <section className="card">
            <div className="stack sm"><h2 className="h3">Private Notizen</h2><span className="small muted">Nur für dich sichtbar.</span></div>
            <ActionForm action={saveCoachNote.bind(null, id)} submit="Notiz speichern" submitClass="btn btn-dark btn-sm">
              <textarea className="textarea" name="body" rows={8} defaultValue={note?.body ?? ""} placeholder="Beobachtungen, Hintergründe, nächste Schritte …" aria-label="Private Notizen" />
            </ActionForm>
          </section>
          <section className="card">
            <h2 className="h3">Ziel & Selbstcheck</h2>
            <div className="stack sm small">
              <div className="row between"><span className="muted">Provision</span><span>{String(profile.commission_pct).replace(".", ",")} %</span></div>
              <div className="row between"><span className="muted">Ø Cash pro Sale</span><span>{euro(profile.avg_cash_per_sale)}</span></div>
              <div className="row between"><span className="muted">Nötig pro Woche</span><span>{int(Math.ceil(plan.perWeek.callsBooked))} Calls im Kalender</span></div>
            </div>
            {selfCheck.length > 0 && (
              <>
                <div className="divider" />
                <div className="stack sm small">
                  {selfCheck.map(([k, v]) => (
                    <div key={k} className="row between"><span className="muted">{SELF_CHECK_LABELS[k] ?? k}</span><span className={v <= 2 ? "warn strong" : undefined}>{v} / 5</span></div>
                  ))}
                </div>
              </>
            )}
          </section>
        </aside>
      </section>
    </>
  );
}

const SELF_CHECK_LABELS: Record<string, string> = {
  showup: "Showup",
  skript: "Skript",
  ton: "Tonalität",
  mensch: "Menschlichkeit",
  frame: "Gesprächsführung",
  pain: "Pain",
  close: "Closing-Frage",
  einwand: "Einwände",
};
