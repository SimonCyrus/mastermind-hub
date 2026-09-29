import Link from "next/link";
import { requireParticipant } from "@/lib/auth";
import type { Bottleneck, CallReflection } from "@/lib/types";
import { todayISO, formatLongDate } from "@/lib/dates";
import { average, OBJECTION_LABELS } from "@/lib/metrics";
import { dec1 } from "@/lib/format";
import { ReflectionForm } from "@/components/reflection-form";

export const metadata = { title: "Call-Reflexion" };

const RESULT_LABEL: Record<string, string> = { close: "Abschluss", followup: "Follow-up", no_close: "Kein Abschluss", deposit: "Anzahlung" };

export default async function ReflexionPage() {
  const { supabase, user } = await requireParticipant();
  const today = todayISO();
  const { data: active } = await supabase.from("bottlenecks").select("*").eq("participant_id", user.id).eq("status", "active").maybeSingle<Bottleneck>();
  const { data: todays } = await supabase.from("call_reflections").select("*").eq("participant_id", user.id).eq("day", today).order("created_at");
  let avgScore: string | null = null;
  if (active) {
    const { data: last } = await supabase.from("call_reflections").select("score").eq("bottleneck_id", active.id).not("score", "is", null).order("created_at", { ascending: false }).limit(10);
    const a = average((last ?? []).map((r) => Number(r.score)));
    avgScore = a !== null ? dec1(a) : null;
  }
  const list = (todays ?? []) as CallReflection[];

  return (
    <div className="stack lg" style={{ maxWidth: 560 }}>
      <header className="stack sm">
        <span className="sub" style={{ fontWeight: 600 }}>Heute · {formatLongDate(today)}</span>
        <h1 className="h1">Check-in</h1>
      </header>
      <div className="segmented" role="tablist">
        <Link href="/checkin" role="tab" aria-selected="false">Tageszahlen</Link>
        <span className="on" role="tab" aria-selected="true">Call-Reflexion</span>
      </div>

      <ReflectionForm
        day={today}
        bottleneck={active ? { id: active.id, title: active.title, question: active.reflection_question } : null}
        avgScore={avgScore}
      />

      {list.length > 0 && (
        <div className="stack sm">
          <span className="label" style={{ padding: "0 4px" }}>Heute reflektiert ({list.length})</span>
          <div className="list-card">
            {list.map((r) => (
              <div key={r.id} className="list-row" style={{ paddingRight: 16 }}>
                <div className="grow stack" style={{ gap: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{r.label || "Call"}{r.result ? ` · ${RESULT_LABEL[r.result]}` : ""}</span>
                  <span className="small muted">
                    {r.objections.length ? r.objections.map((o) => `${OBJECTION_LABELS[o.type]} (${o.solved ? "gelöst" : "offen"})`).join(", ") : "Keine Einwände"}
                  </span>
                </div>
                {r.score && <span className="pill blue">{r.score} / 10</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
