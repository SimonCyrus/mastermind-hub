import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/auth";
import type { BottleneckTemplate } from "@/lib/types";
import { ActionForm, ActionButton } from "@/components/action-form";
import { IconChevronLeft } from "@/components/icons";
import { saveTemplate, deleteTemplate } from "../../actions";

export const metadata = { title: "Engpass bearbeiten" };

export default async function TemplateEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireCoach();
  let t: BottleneckTemplate | null = null;
  if (id !== "neu") {
    const { data } = await supabase.from("bottleneck_templates").select("*").eq("id", id).maybeSingle<BottleneckTemplate>();
    if (!data) notFound();
    t = data;
  }
  return (
    <>
      <div>
        <Link href={t ? `/coach/bibliothek?v=${t.id}` : "/coach/bibliothek"} className="row small strong" style={{ gap: 4 }}><IconChevronLeft width={14} height={14} /> Bibliothek</Link>
      </div>
      <header className="page-head">
        <div>
          <span className="eyebrow">{t ? "Vorlage bearbeiten" : "Neue Vorlage"}</span>
          <h1 className="h1">{t?.name ?? "Neuer Engpass"}</h1>
        </div>
        {t && <ActionButton action={deleteTemplate.bind(null, t.id)} label="Vorlage löschen" className="btn btn-danger btn-sm" confirm="Vorlage löschen? Bereits zugewiesene Engpässe bleiben erhalten." />}
      </header>
      <section className="card" style={{ maxWidth: 900 }}>
        <ActionForm action={saveTemplate.bind(null, t?.id ?? null)} submit={t ? "Speichern" : "Vorlage anlegen"} className="stack lg">
          <div className="grid-2" style={{ gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)" }}>
            <label className="field"><span>Name</span><input className="input" name="name" defaultValue={t?.name} required placeholder="z. B. Tiefer in den Pain" /></label>
            <label className="field"><span>Kategorie</span><input className="input" name="category" defaultValue={t?.category} placeholder="z. B. Bedarfsanalyse" /></label>
          </div>
          <label className="field"><span>Woran du ihn erkennst, ein Anzeichen pro Zeile</span><textarea className="textarea" name="signs" rows={3} defaultValue={t?.signs.join("\n")} /></label>
          <label className="field"><span>Wird vorgeschlagen, wenn …</span><input className="input" name="trigger_text" defaultValue={t?.trigger_text} placeholder="z. B. Ø Pain-Tiefe unter 6 über 10 Calls" /></label>
          <div className="grid-2" style={{ gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)" }}>
            <label className="field"><span>Messgröße</span><input className="input" name="metric_label" defaultValue={t?.metric_label} placeholder="z. B. Pain-Tiefe (1–10)" /></label>
            <label className="field"><span>Zielwert (1–10)</span><input className="input" name="target_score" inputMode="decimal" defaultValue={t?.target_score !== null && t?.target_score !== undefined ? String(t.target_score).replace(".", ",") : ""} /></label>
          </div>
          <label className="field"><span>Frage nach jedem Call</span><input className="input" name="reflection_question" defaultValue={t?.reflection_question} placeholder="z. B. Wie tief bist du in den Pain gekommen?" /></label>
          <label className="field">
            <span>Standard-Drills, einer pro Zeile: Titel | Wie genau | Rhythmus | Dauer</span>
            <textarea className="textarea" name="drills" rows={5} style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 }} defaultValue={t?.drills.map((d) => [d.title, d.description, d.cadence, d.duration].join(" | ")).join("\n")} placeholder={"Mimik im Zoom | Kamera an, aufnehmen | Täglich | 15 Min"} />
          </label>
          <label className="field"><span>Abschlusskriterien, eins pro Zeile</span><textarea className="textarea" name="criteria" rows={3} defaultValue={t?.criteria.join("\n")} /></label>
          <span className="small muted">Änderungen gelten für neue Zuweisungen. Engpässe, die schon bei Teilnehmern laufen, bleiben wie sie sind.</span>
        </ActionForm>
      </section>
    </>
  );
}
