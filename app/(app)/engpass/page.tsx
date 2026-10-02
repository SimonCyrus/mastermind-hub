import { requireParticipant } from "@/lib/auth";
import { loadParticipant, loadNames } from "@/lib/data";
import { scoresFor, objectionStats, weakestObjection, OBJECTION_TEMPLATE } from "@/lib/metrics";
import { todayISO, addDays, dayOf, monthStart, monthEnd } from "@/lib/dates";
import type { BottleneckTemplate } from "@/lib/types";
import { BottleneckHeader, BottleneckSections, AgreementCard } from "@/components/bottleneck-detail";
import { TrainingCalendar } from "@/components/training-calendar";
import type { DrillLog } from "@/lib/types";
import { HistoryCard } from "@/components/dashboard";
import { ProposeForm } from "@/components/propose-form";

export const metadata = { title: "Trainingsplan" };

export default async function EngpassPage({ searchParams }: { searchParams: Promise<{ monat?: string }> }) {
  const { supabase, user } = await requireParticipant();
  const today = todayISO();
  const data = await loadParticipant(supabase, user.id, today);
  const current = data.active ?? data.proposed;
  const { data: tplRows } = await supabase.from("bottleneck_templates").select("id, name, category, slug").order("sort_order");
  const templates = (tplRows ?? []) as Pick<BottleneckTemplate, "id" | "name" | "category" | "slug">[];
  const stats = objectionStats(data.reflections.filter((r) => r.day >= addDays(today, -60)));
  const weakest = weakestObjection(stats);
  const suggestedTemplate = weakest ? templates.find((t) => t.slug === OBJECTION_TEMPLATE[weakest.type])?.id : undefined;

  const names = await loadNames(supabase, [user.id, current?.proposed_by ?? "", current?.activated_by ?? ""]);

  // Kalender: Monat aus der Adresse (?monat=2026-09), sonst aktueller Monat
  const { monat } = await searchParams;
  const calMonth = monat && /^\d{4}-\d{2}$/.test(monat) && `${monat}-01` <= today ? `${monat}-01` : monthStart(today);
  let calLogs: DrillLog[] = data.logs;
  if (data.drills.length && calMonth < addDays(today, -30)) {
    const { data: l } = await supabase.from("drill_logs").select("*").in("drill_id", data.drills.map((d) => d.id)).gte("day", calMonth).lte("day", monthEnd(calMonth));
    calLogs = (l ?? []) as DrillLog[];
  }

  const proposeBlock = !data.proposed && (
    <section className="card" id="vorschlagen">
      <div className="stack sm">
        <h2 className="h2">{data.active ? "Nächsten Engpass vorschlagen" : "Engpass vorschlagen"}</h2>
        <span className="sub">
          {data.active
            ? "Wenn du merkst, was nach dem aktuellen Engpass dran ist, schlag es jetzt vor. Aktiviert wird er erst, wenn der aktuelle gelöst ist."
            : "Dein Coach schaut sich den Vorschlag an. Im nächsten Call legt ihr Diagnose, Drills und Abschlusskriterium gemeinsam fest."}
        </span>
      </div>
      {weakest && <div className="callout blue"><span>Aus deinen Zahlen: <b>{weakest.label}</b> löst du nur in {Math.round((weakest.rate ?? 0) * 100)} % der Fälle.</span></div>}
      <ProposeForm templates={templates} defaultTemplateId={suggestedTemplate} />
    </section>
  );

  if (!current) {
    return (
      <>
        <header className="stack sm">
          <span className="eyebrow">Trainingsplan</span>
          <h1 className="h1">Noch kein Engpass aktiv</h1>
        </header>
        {proposeBlock}
        <HistoryCard bottlenecks={data.bottlenecks} entries={data.entries} today={today} />
      </>
    );
  }

  return (
    <>
      <BottleneckHeader bottleneck={current} today={today} />
      <div className="split">
        <div className="wide">
          <BottleneckSections bottleneck={current} drills={data.drills} logs={data.logs} today={today} scores={scoresFor(data.reflections, current.id)} interactive objections={stats} />
        </div>
        <aside className="narrow">
          <TrainingCalendar
            month={calMonth}
            today={today}
            drills={data.drills}
            logs={calLogs}
            start={current.activated_at ? dayOf(current.activated_at) : null}
            end={current.solved_at ? dayOf(current.solved_at) : null}
            hrefFor={(m) => `/engpass?monat=${m}`}
          />
          <AgreementCard bottleneck={current} names={names} />
        </aside>
      </div>
      {proposeBlock}
      <HistoryCard bottlenecks={data.bottlenecks} entries={data.entries} today={today} />
    </>
  );
}
