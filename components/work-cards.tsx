import type { Drill } from "@/lib/types";
import { parseCadence, WEEKDAY_SHORT } from "@/lib/schedule";

/** Übersichtlich: Wie wird an diesem Engpass gearbeitet? */
export function WorkCards({ drills, title = "So arbeitest du an deinem Engpass" }: { drills: Drill[]; title?: string }) {
  const minutes = drills.reduce((sum, d) => {
    const m = d.duration.match(/(\d+)\s*min/i);
    const s = parseCadence(d.cadence);
    const perWeek = s.kind === "once" ? 0 : s.days.length;
    return sum + (m ? Number(m[1]) * perWeek : 0);
  }, 0);
  return (
    <section className="card" style={{ gap: 20 }}>
      <div className="card-head" style={{ flexWrap: "wrap" }}>
        <div>
          <span className="eyebrow">Dein Plan</span>
          <h2 className="h2" style={{ fontSize: 22 }}>{title}</h2>
        </div>
        {minutes > 0 && (
          <div className="stack" style={{ gap: 0, alignItems: "flex-end" }}>
            <span style={{ fontSize: 22, fontWeight: 700 }}>≈ {Math.round(minutes / 5) * 5} Min</span>
            <span className="small muted">Training pro Woche</span>
          </div>
        )}
      </div>
      {drills.length === 0 ? (
        <span className="sub">Die Drills legt ihr im nächsten Coaching-Call gemeinsam fest.</span>
      ) : (
        <div className="work-grid">
          {drills.map((d, i) => {
            const s = parseCadence(d.cadence);
            return (
              <div key={d.id} className="work-card">
                <div className="row between" style={{ alignItems: "flex-start", gap: 12 }}>
                  <span className="work-num">{String(i + 1).padStart(2, "0")}</span>
                  {d.duration && d.duration !== "–" && <span className="pill">{d.duration}</span>}
                </div>
                <div className="stack" style={{ gap: 4 }}>
                  <span className="h3">{d.title}</span>
                  {d.description && <span className="sub" style={{ lineHeight: 1.45 }}>{d.description}</span>}
                </div>
                <div className="stack" style={{ gap: 8, marginTop: "auto" }}>
                  {s.kind === "once" ? (
                    <span className="small strong">Einmalig zum Start</span>
                  ) : (
                    <div className="wd-dots" aria-label={`Wochentage: ${s.days.map((x) => WEEKDAY_SHORT[x]).join(", ")}`}>
                      {WEEKDAY_SHORT.map((w, idx) => <span key={w} className={s.days.includes(idx) ? "on" : undefined}>{w}</span>)}
                    </div>
                  )}
                  {d.cadence && <span className="small muted">{d.cadence}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
