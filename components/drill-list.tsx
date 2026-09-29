"use client";

import { useOptimistic, useTransition } from "react";
import { toggleDrill } from "@/app/(app)/actions";
import { IconCheck } from "./icons";

export type DrillItem = { id: string; title: string; meta: string; done: boolean };

export function DrillList({ drills, day, interactive }: { drills: DrillItem[]; day: string; interactive: boolean }) {
  const [, startTransition] = useTransition();
  const [items, setOptimistic] = useOptimistic(drills, (state, change: { id: string; done: boolean }) =>
    state.map((d) => (d.id === change.id ? { ...d, done: change.done } : d))
  );
  const doneCount = items.filter((d) => d.done).length;

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row between">
        <span className="label">{interactive ? "So trainierst du heute" : "Drills"}</span>
        {interactive && items.length > 0 && <span className="small muted">{doneCount} von {items.length}</span>}
      </div>
      {items.length === 0 && <span className="sub">Die Drills legt ihr im nächsten Coaching-Call fest.</span>}
      <div className="stack sm">
        {items.map((d) =>
          interactive ? (
            <button
              key={d.id}
              type="button"
              className={`drill-btn${d.done ? " done" : ""}`}
              aria-pressed={d.done}
              onClick={() =>
                startTransition(async () => {
                  setOptimistic({ id: d.id, done: !d.done });
                  await toggleDrill(d.id, day, !d.done);
                })
              }
            >
              <span className={`check ${d.done ? "done" : "open"}`} style={{ marginTop: 1 }}>
                {d.done && <IconCheck width={12} height={12} stroke="#fff" />}
              </span>
              <span className="stack" style={{ gap: 2 }}>
                <span className="t">{d.title}</span>
                {d.meta && <span className="m">{d.meta}</span>}
              </span>
            </button>
          ) : (
            <div key={d.id} className="stack" style={{ gap: 2, padding: "6px 0" }}>
              <span style={{ fontSize: 15, fontWeight: 500 }}>{d.title}</span>
              {d.meta && <span className="small muted">{d.meta}</span>}
            </div>
          )
        )}
      </div>
    </div>
  );
}
