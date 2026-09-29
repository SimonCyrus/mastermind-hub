"use client";

import { useActionState, useEffect, useState } from "react";
import { saveReflection, type FormState } from "@/app/(app)/actions";
import type { ObjectionType } from "@/lib/types";

const RESULTS: [string, string][] = [["close", "Abschluss im Call"], ["followup", "Follow-up offen"], ["no_close", "Kein Abschluss"], ["deposit", "Anzahlung"]];
const OBJECTIONS: [ObjectionType, string][] = [
  ["logistisch_geld", "Logistisch – Geld"],
  ["logistisch_partner", "Logistisch – Partner"],
  ["angst_geld", "Angst – Geld"],
  ["angst_partner", "Angst – Partner"],
  ["denke_drueber_nach", "Denke drüber nach"],
  ["zeit", "Zeit"],
  ["wert", "Wert"],
];

export function ReflectionForm({ day, bottleneck, avgScore }: {
  day: string;
  bottleneck: { id: string; title: string; question: string } | null;
  avgScore: string | null;
}) {
  const [result, setResult] = useState<string>("");
  const [score, setScore] = useState<number | null>(null);
  const [objs, setObjs] = useState<Partial<Record<ObjectionType, boolean>>>({});
  const [formKey, setFormKey] = useState(0);
  const [state, action, pending] = useActionState<FormState, FormData>(saveReflection, undefined);
  const [showSaved, setShowSaved] = useState(false);
  useEffect(() => {
    if (state?.ok) setShowSaved(true);
  }, [state]);

  const selected = OBJECTIONS.filter(([t]) => t in objs);

  const reset = () => {
    setResult("");
    setScore(null);
    setObjs({});
    setShowSaved(false);
    setFormKey((k) => k + 1);
  };

  if (showSaved) {
    return (
      <div className="card" style={{ alignItems: "flex-start" }}>
        <span className="h2">Reflexion gespeichert.</span>
        <span className="sub">Sie fließt in deine Engpass-Messung und dein Einwand-Tracking ein.</span>
        <button className="btn btn-primary" type="button" onClick={reset}>Nächsten Call reflektieren</button>
      </div>
    );
  }

  return (
    <form
      key={formKey}
      className="stack lg"
      action={action}
    >
      <input type="hidden" name="day" value={day} />
      <input type="hidden" name="result" value={result} />
      <input type="hidden" name="score" value={score ?? ""} />
      <input type="hidden" name="bottleneck_id" value={bottleneck?.id ?? ""} />
      <input type="hidden" name="objections" value={JSON.stringify(selected.map(([t]) => ({ type: t, solved: !!objs[t] })))} />

      <label className="field">
        <span>Welcher Call? (optional)</span>
        <input className="input" name="label" placeholder="z. B. Erstgespräch 14:30" maxLength={120} />
      </label>

      <div className="stack sm">
        <span className="label" style={{ padding: "0 4px" }}>Ergebnis</span>
        <div className="choice-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          {RESULTS.map(([k, label]) => (
            <button key={k} type="button" className={`choice${result === k ? " on" : ""}`} aria-pressed={result === k} onClick={() => setResult(result === k ? "" : k)}>{label}</button>
          ))}
        </div>
      </div>

      {bottleneck && (
        <div className="card" style={{ boxShadow: "0 0 0 1.5px var(--accent)", padding: "20px 16px", gap: 16 }}>
          <div className="stack sm">
            <span className="eyebrow" style={{ fontSize: 11 }}>Dein Engpass · {bottleneck.title}</span>
            <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.25 }}>{bottleneck.question || "Wie gut hast du deinen Engpass in diesem Call umgesetzt?"}</span>
          </div>
          <div className="scale" role="radiogroup" aria-label="Bewertung von 1 bis 10">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" role="radio" aria-checked={score === n} aria-label={`${n} von 10`} className={score === n ? "on" : undefined} onClick={() => setScore(n)}>{n}</button>
            ))}
          </div>
          <div className="row between small muted"><span>1 = gar nicht</span>{avgScore && <span>Ø letzte 10: {avgScore}</span>}<span>10 = perfekt</span></div>
        </div>
      )}

      <div className="stack sm">
        <span className="label" style={{ padding: "0 4px" }}>Welche Einwände kamen?</span>
        <div className="chips">
          {OBJECTIONS.map(([t, label]) => {
            const on = t in objs;
            return (
              <button
                key={t}
                type="button"
                className={`chip${on ? " on" : ""}`}
                aria-pressed={on}
                onClick={() => setObjs((s) => { const n = { ...s }; if (on) delete n[t]; else n[t] = false; return n; })}
              >{label}</button>
            );
          })}
        </div>
        {selected.length > 0 && (
          <div className="list-card" style={{ marginTop: 4 }}>
            {selected.map(([t, label]) => (
              <div key={t} className="list-row">
                <span className="grow" style={{ fontSize: 15 }}>{label}</span>
                <div className="segmented" style={{ width: 180, background: "var(--fill)" }}>
                  <button type="button" className={objs[t] ? "on" : undefined} style={objs[t] ? { background: "var(--good)", color: "#fff" } : undefined} onClick={() => setObjs((s) => ({ ...s, [t]: true }))}>Gelöst</button>
                  <button type="button" className={!objs[t] ? "on" : undefined} style={!objs[t] ? { background: "var(--warn)", color: "#fff" } : undefined} onClick={() => setObjs((s) => ({ ...s, [t]: false }))}>Offen</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <label className="field">
        <span>Was hat funktioniert?</span>
        <textarea className="textarea" name="what_worked" rows={3} maxLength={2000} placeholder="z. B. Frage nach seinem Umzug hat das Eis gebrochen" />
      </label>
      <label className="field">
        <span>Was machst du beim nächsten Call anders?</span>
        <textarea className="textarea" name="next_time" rows={3} maxLength={2000} placeholder="Ein Satz reicht" />
      </label>

      {state?.error && <p className="form-error" role="alert">{state.error}</p>}
      <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={pending}>{pending ? "Speichert …" : "Reflexion speichern"}</button>
    </form>
  );
}
