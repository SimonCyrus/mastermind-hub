import { requireParticipant } from "@/lib/auth";
import { loadParticipant, loadComments, loadNames } from "@/lib/data";
import { scoresFor, objectionStats, weakestObjection, OBJECTION_TEMPLATE } from "@/lib/metrics";
import { todayISO, addDays } from "@/lib/dates";
import type { BottleneckTemplate } from "@/lib/types";
import { BottleneckHeader, BottleneckSections, AgreementCard, CommentsCard, commentViews } from "@/components/bottleneck-detail";
import { HistoryCard } from "@/components/dashboard";
import { ProposeForm } from "@/components/propose-form";
import { addComment } from "../actions";

export const metadata = { title: "Trainingsplan" };

export default async function EngpassPage() {
  const { supabase, user } = await requireParticipant();
  const today = todayISO();
  const data = await loadParticipant(supabase, user.id, today);
  const current = data.active ?? data.proposed;
  const { data: tplRows } = await supabase.from("bottleneck_templates").select("id, name, category, slug").order("sort_order");
  const templates = (tplRows ?? []) as Pick<BottleneckTemplate, "id" | "name" | "category" | "slug">[];
  const stats = objectionStats(data.reflections.filter((r) => r.day >= addDays(today, -60)));
  const weakest = weakestObjection(stats);
  const suggestedTemplate = weakest ? templates.find((t) => t.slug === OBJECTION_TEMPLATE[weakest.type])?.id : undefined;

  const comments = current ? await loadComments(supabase, current.id) : [];
  const names = await loadNames(supabase, [user.id, current?.proposed_by ?? "", current?.activated_by ?? "", ...comments.map((c) => c.author_id)]);

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
          <AgreementCard bottleneck={current} names={names} />
          <CommentsCard comments={commentViews(comments, names, user.id)} action={addComment.bind(null, current.id)} placeholder="Nachricht an deinen Coach" />
        </aside>
      </div>
      {proposeBlock}
      <HistoryCard bottlenecks={data.bottlenecks} entries={data.entries} today={today} />
    </>
  );
}
