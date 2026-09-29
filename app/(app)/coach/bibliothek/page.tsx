import Link from "next/link";
import { requireCoach } from "@/lib/auth";
import { fetchAll, normalizeEntry } from "@/lib/data";
import { programStats } from "@/lib/coach";
import type { Bottleneck, BottleneckTemplate, DailyEntry } from "@/lib/types";
import { todayISO, addDays } from "@/lib/dates";
import { dec1 } from "@/lib/format";
import { IconBolt, IconCheck } from "@/components/icons";

export const metadata = { title: "Engpass-Bibliothek" };

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { supabase } = await requireCoach();
  const { v } = await searchParams;
  const today = todayISO();
  const [{ data: rows }, bottlenecks, entries] = await Promise.all([
    supabase.from("bottleneck_templates").select("*").order("sort_order").order("name"),
    fetchAll<Bottleneck>(() => supabase.from("bottlenecks").select("*").order("id")),
    fetchAll<DailyEntry>(() => supabase.from("daily_entries").select("*").gte("day", addDays(today, -365)).order("participant_id").order("day")),
  ]);
  const templates = (rows ?? []) as BottleneckTemplate[];
  const sel = templates.find((t) => t.id === v) ?? templates[0];

  const entriesBy = new Map<string, DailyEntry[]>();
  for (const e of entries.map(normalizeEntry)) entriesBy.set(e.participant_id, [...(entriesBy.get(e.participant_id) ?? []), e]);
  const usage = (tplId: string) => {
    const bs = bottlenecks.filter((b) => b.template_id === tplId);
    const st = programStats(bs, entriesBy, today);
    return { uses: bs.filter((b) => b.status !== "archived").length, days: st.avgDaysToSolve, impact: st.avgImpact };
  };
  const u = sel ? usage(sel.id) : null;

  return (
    <>
      <header className="page-head">
        <div>
          <span className="sub" style={{ fontWeight: 500 }}>{templates.length} Vorlagen · einmal pflegen, pro Teilnehmer anpassen</span>
          <h1 className="h1">Engpass-Bibliothek</h1>
        </div>
        <Link className="btn btn-primary" href="/coach/bibliothek/neu">Neuer Engpass</Link>
      </header>

      <div className="split">
        <nav className="card" style={{ flex: "0 0 320px", padding: 10, gap: 2 }} aria-label="Vorlagen">
          {templates.map((t) => {
            const on = t.id === sel?.id;
            const n = usage(t.id).uses;
            return (
              <Link
                key={t.id}
                href={`/coach/bibliothek?v=${t.id}`}
                className="row"
                style={{ padding: "12px 14px", minHeight: 56, borderRadius: 14, background: on ? "var(--ink)" : undefined, color: on ? "#fff" : "var(--text)", gap: 12 }}
              >
                <span className="stack" style={{ gap: 2, flex: 1 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{t.name}</span>
                  <span className="small" style={{ color: on ? "#a1a1a6" : "var(--muted)" }}>{t.category}</span>
                </span>
                <span className="small" style={{ color: on ? "#a1a1a6" : "var(--muted)" }}>{n > 0 ? `${n}×` : "neu"}</span>
              </Link>
            );
          })}
        </nav>

        {sel && u && (
          <section className="card" style={{ flex: "1 1 0", padding: "32px 36px", gap: 26 }}>
            <div className="card-head" style={{ flexWrap: "wrap" }}>
              <div style={{ gap: 10 }}>
                <span className="pill" style={{ alignSelf: "flex-start" }}>{sel.category || "Ohne Kategorie"}</span>
                <h2 className="h1" style={{ fontSize: 36 }}>{sel.name}</h2>
              </div>
              <Link className="btn btn-soft btn-sm" href={`/coach/bibliothek/${sel.id}`}>Bearbeiten</Link>
            </div>

            <div className="grid-3" style={{ gap: 12 }}>
              <div className="soft-panel stack" style={{ gap: 4 }}><span className="label" style={{ fontSize: 12 }}>Eingesetzt</span><span style={{ fontSize: 22, fontWeight: 700 }}>{u.uses > 0 ? `${u.uses}×` : "noch nie"}</span></div>
              <div className="soft-panel stack" style={{ gap: 4 }}><span className="label" style={{ fontSize: 12 }}>Ø Dauer bis gelöst</span><span style={{ fontSize: 22, fontWeight: 700 }}>{u.days !== null ? `${Math.round(u.days)} Tage` : "–"}</span></div>
              <div className="soft-panel stack" style={{ gap: 4 }}><span className="label" style={{ fontSize: 12 }}>Ø Closing-Zuwachs</span><span style={{ fontSize: 22, fontWeight: 700, color: u.impact && u.impact > 0 ? "var(--good)" : undefined }}>{u.impact !== null ? `${u.impact >= 0 ? "+" : "−"}${dec1(Math.abs(u.impact * 100))} Pp.` : "–"}</span></div>
            </div>

            <div className="grid-2" style={{ gap: 28 }}>
              <div className="stack">
                <span className="label">Woran du ihn erkennst</span>
                {sel.signs.map((s, i) => (
                  <div key={i} className="row start" style={{ gap: 10, fontSize: 15, lineHeight: 1.45 }}>
                    <span style={{ width: 5, height: 5, borderRadius: 3, background: "var(--ink)", flexShrink: 0, marginTop: 9 }} />
                    <span>{s}</span>
                  </div>
                ))}
              </div>
              <div className="stack">
                <span className="label">Wird vorgeschlagen, wenn</span>
                <div className="callout blue" style={{ justifyContent: "flex-start", alignItems: "flex-start" }}>
                  <IconBolt width={18} height={18} stroke="#0071e3" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 15 }}>{sel.trigger_text || "–"}</span>
                </div>
                <span className="label" style={{ marginTop: 8 }}>Messgröße &amp; Frage nach jedem Call</span>
                <span className="strong">{sel.metric_label || "–"}{sel.target_score !== null ? ` · Ziel ${String(sel.target_score).replace(".", ",")}` : ""}</span>
                <span style={{ color: "var(--text-2)" }}>{sel.reflection_question ? `„${sel.reflection_question}“` : ""}</span>
              </div>
            </div>

            <div className="table">
              <span className="label" style={{ paddingBottom: 8 }}>Standard-Drills</span>
              <div className="thead" style={{ gridTemplateColumns: "minmax(0,1fr) 150px 90px" }}><span>Drill</span><span>Rhythmus</span><span>Dauer</span></div>
              {sel.drills.map((d, i) => (
                <div key={i} className="trow" style={{ gridTemplateColumns: "minmax(0,1fr) 150px 90px", fontSize: 15 }}>
                  <div className="stack" style={{ gap: 2 }}><span className="strong">{d.title}</span><span className="small muted">{d.description}</span></div>
                  <span style={{ color: "var(--text-2)" }}>{d.cadence}</span>
                  <span style={{ color: "var(--text-2)" }}>{d.duration}</span>
                </div>
              ))}
            </div>

            <div className="stack sm">
              <span className="label">Abschlusskriterium, alle nötig</span>
              <div className="chips">
                {sel.criteria.map((c, i) => (
                  <span key={i} className="row" style={{ gap: 8, padding: "10px 14px", borderRadius: 12, boxShadow: "0 0 0 1px var(--line)", fontSize: 14 }}>
                    <IconCheck width={14} height={14} />{c}
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}
        {!sel && (
          <section className="card empty" style={{ flex: 1 }}>
            <span className="h3">Die Bibliothek ist leer</span>
            <Link className="btn btn-primary" href="/coach/bibliothek/neu">Ersten Engpass anlegen</Link>
          </section>
        )}
      </div>
    </>
  );
}
