"use client";

import { useMemo, useState, useTransition } from "react";
import { completeOnboarding } from "@/app/(app)/actions";
import { planGoal } from "@/lib/metrics";
import type { SalesRole } from "@/lib/types";
import { Brand } from "./brand";

const ROLES: [SalesRole, string, string][] = [
  ["setter", "Setting", "Outbound, Leads qualifizieren, Termine legen"],
  ["closer", "Closing", "Sales-Calls führen und abschließen"],
  ["both", "Beides", "Termine legen und selbst closen"],
];

const fmt = (n: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(Math.round(n));
const num = (s: string) => {
  const n = Number(s.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export function OnboardingWizard({ firstName, coachName }: { firstName: string; coachName: string }) {
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<SalesRole>("both");
  const [g, setG] = useState({ goal: "10.000", pct: "10", avg: "2.800", show: "80", close: "30" });
  const [pending, startTransition] = useTransition();

  const plan = useMemo(
    () => planGoal({ commissionGoal: num(g.goal), commissionPct: num(g.pct), avgCashPerSale: num(g.avg), showupPct: num(g.show), closePct: num(g.close) }),
    [g]
  );
  const canFinish = num(g.goal) > 0 && num(g.pct) > 0;

  const finish = () => {
    const fd = new FormData();
    fd.set("sales_role", role);
    fd.set("commission_goal", String(num(g.goal)));
    fd.set("commission_pct", String(num(g.pct)));
    fd.set("avg_cash_per_sale", String(num(g.avg)));
    fd.set("assumed_showup_pct", String(num(g.show)));
    fd.set("assumed_close_pct", String(num(g.close)));
    startTransition(() => completeOnboarding(fd));
  };

  const goalFields: [keyof typeof g, string, string][] = [
    ["goal", "Provisionsziel pro Monat", "€"],
    ["pct", "Deine Provision", "%"],
    ["avg", "Ø Cash collected pro Sale", "€"],
    ["show", "Showup-Rate", "%"],
    ["close", "Closing-Rate", "%"],
  ];

  return (
    <div className="ob-wrap">
      <header className="ob-top">
        <Brand />
        <div className="row" style={{ gap: 14 }}>
          <span className="small strong muted">Schritt {step + 1} von 2</span>
          <div className="progress hide-mobile"><div style={{ width: `${(step + 1) * 50}%` }} /></div>
        </div>
      </header>
      <div className="ob-body">
        <div className="ob-inner">
          {step === 0 && (
            <>
              <div className="stack">
                <span className="eyebrow">Willkommen im Mastermind{firstName ? `, ${firstName}` : ""}</span>
                <h1 className="h-hero" style={{ fontSize: 48 }}>In zwei Minuten bist du startklar.</h1>
                <p className="sub" style={{ fontSize: 18, lineHeight: 1.5 }}>Wir rechnen aus, was du für dein Ziel brauchst. Deinen ersten Engpass legen wir dann im ersten Coaching-Call gemeinsam fest.</p>
              </div>
              <div className="stack">
                <span className="strong">Was machst du im Vertrieb?</span>
                <div className="grid-3" style={{ gap: 12 }}>
                  {ROLES.map(([k, label, desc]) => (
                    <button key={k} type="button" className={`role-card${role === k ? " on" : ""}`} aria-pressed={role === k} onClick={() => setRole(k)}>
                      <span style={{ fontSize: 17, fontWeight: 650 }}>{label}</span>
                      <span className="sub" style={{ lineHeight: 1.4 }}>{desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="stack">
                <span className="eyebrow">Dein Ziel</span>
                <h1 className="h1" style={{ fontSize: 40 }}>Wie viel Provision willst du im Monat?</h1>
                <p className="sub" style={{ fontSize: 17 }}>Wir rechnen rückwärts, was das für deine Woche bedeutet. Die Quoten sind Schätzungen, deine echten Zahlen siehst du nach den ersten Tagen im Dashboard.</p>
              </div>
              <div className="grid-2" style={{ gap: 12 }}>
                {goalFields.map(([k, label, unit]) => (
                  <label key={k} className="list-card" style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: "6px 18px", minHeight: 60 }}>
                    <span style={{ flex: 1, fontSize: 15 }}>{label}</span>
                    <input className="num-input" style={{ width: 110, fontSize: 20 }} inputMode="decimal" value={g[k]} onChange={(e) => setG((s) => ({ ...s, [k]: e.target.value.replace(/[^\d.,]/g, "") }))} />
                    <span className="muted" style={{ width: 16, fontSize: 17 }}>{unit}</span>
                  </label>
                ))}
              </div>
              <div className="card ink" style={{ padding: "24px 28px", gap: 14 }}>
                <div className="thead" style={{ gridTemplateColumns: "minmax(0,1fr) 130px 130px", color: "var(--on-ink-muted)", borderColor: "#3a3a3c" }}>
                  <span>Das brauchst du</span><span style={{ textAlign: "right" }}>pro Monat</span><span style={{ textAlign: "right" }}>pro Woche</span>
                </div>
                {[
                  ["Cash collected", `${fmt(plan.cash)} €`, `${fmt(plan.perWeek.cash)} €`],
                  ["Sales", fmt(Math.ceil(plan.sales)), fmt(Math.ceil(plan.perWeek.sales))],
                  ["Sales-Calls geführt", fmt(Math.ceil(plan.callsHeld)), fmt(Math.ceil(plan.perWeek.callsHeld))],
                  ["Sales-Calls im Kalender", fmt(Math.ceil(plan.callsBooked)), fmt(Math.ceil(plan.perWeek.callsBooked))],
                ].map(([l, m, w]) => (
                  <div key={l} className="trow" style={{ gridTemplateColumns: "minmax(0,1fr) 130px 130px", borderColor: "#2c2c2e", padding: "8px 0" }}>
                    <span style={{ color: "#d1d1d6", fontSize: 16 }}>{l}</span>
                    <span style={{ textAlign: "right", fontSize: 22, fontWeight: 700 }}>{m}</span>
                    <span style={{ textAlign: "right", fontSize: 22, fontWeight: 700, color: "#64a8f0" }}>{w}</span>
                  </div>
                ))}
              </div>
              <div className="callout blue" style={{ justifyContent: "flex-start" }}>
                <span>Deinen ersten Engpass legst du mit {coachName || "deinem Coach"} im ersten Coaching-Call gemeinsam fest. Bis dahin kannst du schon deine Tageszahlen tracken.</span>
              </div>
            </>
          )}

          <div className="row between" style={{ paddingTop: 8 }}>
            {step > 0 ? <button type="button" className="btn btn-soft" onClick={() => setStep(step - 1)}>Zurück</button> : <span />}
            {step === 0 ? (
              <button type="button" className="btn btn-primary" style={{ height: 48, padding: "0 28px", borderRadius: 24 }} onClick={() => setStep(1)}>
                Weiter
              </button>
            ) : (
              <button type="button" className="btn btn-primary" style={{ height: 48, padding: "0 28px", borderRadius: 24 }} disabled={pending || !canFinish} onClick={finish}>
                {pending ? "Wird eingerichtet …" : "Los geht’s"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
