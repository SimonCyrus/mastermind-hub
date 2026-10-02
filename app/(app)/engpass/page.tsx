import { requireParticipant } from "@/lib/auth";
import { loadParticipant, loadNames } from "@/lib/data";
import { objectionStats, weakestObjection, OBJECTION_TEMPLATE } from "@/lib/metrics";
import { todayISO, addDays, weekStart } from "@/lib/dates";
import { loadPlanner, plannerStart } from "@/lib/planner";
import type { BottleneckTemplate } from "@/lib/types";
import { BottleneckHeader, BottleneckSections, AgreementCard } from "@/components/bottleneck-detail";
import { WorkCards } from "@/components/work-cards";
import { DayPlanner } from "@/components/day-planner";
import { HistoryCard } from "@/components/dashboard";
import { ProposeForm } from "@/components/propose-form";

export const metadata = { title: "Trainingsplan" };

export default async function EngpassPage({ searchParams }: { searchParams: Promise<{ woche?: string }> }) {
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

  // Beschreibbarer Trainingskalender: 4 Wochen ab ?woche=… (Standard: aktuelle Woche)
  const { woche } = await searchParams;
  const monday = plannerStart(woche, today);
  const plan = await loadPlanner(supabase, user.id, monday);
  const suggestions = [...new Set([data.active?.title, ...templates.map((t) => t.name)].filter((x): x is string => !!x))];
  const planner = (
    <DayPlanner
      weeks={plan.weeks}
      participantId={user.id}
      today={today}
      defaultFocus={data.active?.title ?? ""}
      suggestions={suggestions}
      prevHref={`/engpass?woche=${plan.prev}`}
      nextHref={`/engpass?woche=${plan.next}`}
      todayHref={monday !== weekStart(today) ? "/engpass" : null}
      missingTable={plan.missingTable}
      title="Dein Trainingsplan"
      subtitle="Für jeden Tag: Woran arbeitest du, und wie trainierst du es?"
    />
  );

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
          <p className="sub">Euren nächsten Engpass legt ihr im Coaching-Call gemeinsam fest. Danach siehst du hier deinen Trainingskalender.</p>
        </header>
        {planner}
        <HistoryCard bottlenecks={data.bottlenecks} entries={data.entries} today={today} />
      </>
    );
  }


  return (
    <>
      <BottleneckHeader bottleneck={current} today={today} />
      <div className="split">
        <div className="wide">
          <BottleneckSections bottleneck={current} drills={data.drills} logs={data.logs} today={today} scores={[]} interactive={false} objections={stats} whyOnly />
        </div>
        <aside className="narrow">
          <AgreementCard bottleneck={current} names={names} />
        </aside>
      </div>

      <WorkCards drills={data.drills} />

      {planner}

      {proposeBlock}
      <HistoryCard bottlenecks={data.bottlenecks} entries={data.entries} today={today} />
    </>
  );
}
