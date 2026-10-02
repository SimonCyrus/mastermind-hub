import { requireParticipant } from "@/lib/auth";
import { loadParticipant, loadNames, daysInBottleneck } from "@/lib/data";
import { objectionStats, weakestObjection, OBJECTION_TEMPLATE } from "@/lib/metrics";
import { todayISO, addDays, dayOf, formatDayMonth, weekStart } from "@/lib/dates";
import { buildPlan, currentWeekIndex } from "@/lib/plan";
import { pad2 } from "@/lib/format";
import type { BottleneckTemplate, DrillLog } from "@/lib/types";
import { BottleneckHeader, BottleneckSections, AgreementCard } from "@/components/bottleneck-detail";
import { WorkCards } from "@/components/work-cards";
import { PlanCalendar } from "@/components/plan-calendar";
import { HistoryCard } from "@/components/dashboard";
import { ProposeForm } from "@/components/propose-form";

export const metadata = { title: "Trainingsplan" };

const WINDOW = 4;

export default async function EngpassPage({ searchParams }: { searchParams: Promise<{ ab?: string }> }) {
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
        <HistoryCard bottlenecks={data.bottlenecks} entries={data.entries} today={today} />
      </>
    );
  }

  // Trainingskalender: 4 Wochen, Woche 1 = Start des Engpasses
  const start = current.activated_at ? dayOf(current.activated_at) : null;
  const cur = currentWeekIndex(start, today);
  const { ab } = await searchParams;
  const maxFrom = Math.max(1, cur - 1);
  const requested = Number(ab);
  const from = Number.isInteger(requested) && requested >= 1 ? Math.min(requested, maxFrom) : Math.max(1, cur - 2);
  const windowStart = addDays(weekStart(start ?? today), (from - 1) * 7);
  const windowEnd = addDays(windowStart, WINDOW * 7 - 1);
  let logs: DrillLog[] = [];
  if (data.drills.length) {
    const { data: l } = await supabase.from("drill_logs").select("*").in("drill_id", data.drills.map((d) => d.id)).gte("day", windowStart).lte("day", windowEnd);
    logs = (l ?? []) as DrillLog[];
  }
  const weeks = buildPlan({ drills: data.drills, logs, start, end: null, today, fromWeek: from, weeks: WINDOW, editable: current.status === "active" });
  const day = daysInBottleneck(current, today);

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

      <PlanCalendar
        weeks={weeks}
        title={`Engpass ${pad2(current.seq)} · ${current.title}`}
        subtitle={start ? `Seit ${formatDayMonth(start)} · Tag ${day} · läuft, bis er gelöst ist` : "Vorschau: Der Kalender startet, sobald ihr den Engpass gemeinsam aktiviert habt."}
        rangeLabel={`Woche ${from}–${from + WINDOW - 1}`}
        prevHref={from > 1 ? `/engpass?ab=${Math.max(1, from - WINDOW)}` : null}
        nextHref={from < maxFrom ? `/engpass?ab=${Math.min(maxFrom, from + WINDOW)}` : null}
        hint={current.status === "active" ? "Antippen zum Abhaken, auch für vergangene Tage." : undefined}
      />

      {proposeBlock}
      <HistoryCard bottlenecks={data.bottlenecks} entries={data.entries} today={today} />
    </>
  );
}
