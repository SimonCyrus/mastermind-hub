"use client";

import { useActionState, useOptimistic, useTransition, useState } from "react";
import type { Criterion, Drill } from "@/lib/types";
import type { FormState } from "@/app/(app)/actions";
import { setCriterion, saveDrill, deleteDrill } from "@/app/(app)/coach/actions";
import { IconCheck, IconTrash } from "./icons";

export function CriteriaToggles({ bottleneckId, criteria }: { bottleneckId: string; criteria: Criterion[] }) {
  const [, start] = useTransition();
  const [items, setOpt] = useOptimistic(criteria, (s, c: { i: number; done: boolean }) => s.map((x, j) => (j === c.i ? { ...x, done: c.done } : x)));
  if (items.length === 0) return <span className="sub">Noch keine Kriterien. Trag sie unten im Formular ein, eins pro Zeile.</span>;
  return (
    <div className="stack sm">
      {items.map((c, i) => (
        <button
          key={i}
          type="button"
          className={`drill-btn${c.done ? "" : ""}`}
          aria-pressed={c.done}
          onClick={() => start(async () => { setOpt({ i, done: !c.done }); await setCriterion(bottleneckId, i, !c.done); })}
        >
          <span className={`check ${c.done ? "done" : "open"}`}>{c.done && <IconCheck width={12} height={12} stroke="#fff" />}</span>
          <span className="t">{c.label}</span>
        </button>
      ))}
      <span className="small muted">Abhaken, sobald erfüllt. Der Teilnehmer sieht den Stand sofort.</span>
    </div>
  );
}

function DrillRow({ bottleneckId, participantId, drill }: { bottleneckId: string; participantId: string; drill: Drill | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveDrill.bind(null, bottleneckId, drill?.id ?? null), undefined);
  const [, start] = useTransition();
  const [formKey, setFormKey] = useState(0);
  return (
    <form
      key={formKey}
      action={async (fd) => {
        action(fd);
        if (!drill) setFormKey((k) => k + 1);
      }}
      className="stack sm"
      style={{ padding: "14px 0", borderTop: "1px solid var(--line)" }}
    >
      <div className="grid-2" style={{ gridTemplateColumns: "minmax(0,2fr) minmax(0,3fr)", gap: 10 }}>
        <input className="input" name="title" defaultValue={drill?.title} placeholder={drill ? "Titel" : "Neuer Drill, z. B. Mimik im Zoom"} aria-label="Titel" required />
        <input className="input" name="description" defaultValue={drill?.description} placeholder="Wie genau?" aria-label="Beschreibung" />
      </div>
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <input className="input" name="cadence" defaultValue={drill?.cadence} placeholder="Rhythmus, z. B. Täglich oder Mo, Mi, Fr" aria-label="Rhythmus" title="Bestimmt, an welchen Tagen der Drill im Kalender steht: Täglich, werktags, Mo, Mi, Fr, 2× pro Woche, Einmalig" style={{ width: 260 }} />
        <input className="input" name="duration" defaultValue={drill?.duration} placeholder="Dauer, z. B. 15 Min" aria-label="Dauer" style={{ width: 150 }} />
        <button className={drill ? "btn btn-soft btn-sm" : "btn btn-dark btn-sm"} type="submit" disabled={pending}>{drill ? "Speichern" : "Drill hinzufügen"}</button>
        {drill && (
          <button
            className="btn btn-sm btn-danger"
            type="button"
            aria-label="Drill löschen"
            onClick={() => { if (window.confirm(`„${drill.title}“ löschen? Die Abhak-Historie geht verloren.`)) start(() => deleteDrill(drill.id, participantId)); }}
          >
            <IconTrash width={14} height={14} />
          </button>
        )}
        {state?.ok && !pending && drill && <span className="small good strong">{state.ok}</span>}
        {state?.error && <span className="small warn">{state.error}</span>}
      </div>
    </form>
  );
}

export function DrillEditor({ bottleneckId, participantId, drills }: { bottleneckId: string; participantId: string; drills: Drill[] }) {
  return (
    <div className="stack" style={{ gap: 0 }}>
      {drills.map((d) => <DrillRow key={d.id} bottleneckId={bottleneckId} participantId={participantId} drill={d} />)}
      <DrillRow bottleneckId={bottleneckId} participantId={participantId} drill={null} />
    </div>
  );
}
