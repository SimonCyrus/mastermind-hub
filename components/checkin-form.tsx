"use client";

import { useActionState, useMemo, useState } from "react";
import { saveDaily, type FormState } from "@/app/(app)/actions";
import type { DailyCountField, SalesRole } from "@/lib/types";
import { IconMinus, IconPlusSmall } from "./icons";

type Values = Record<DailyCountField, number> & { order_volume: string; cash_collected: string };

const GROUPS: { title: string; roles: SalesRole[]; fields: [DailyCountField, string][] }[] = [
  { title: "Outbound", roles: ["setter", "both"], fields: [["dials", "Anwahlversuche"], ["pickups", "Pickups"], ["conversations", "Gespräche 30 Sek.+"], ["booked_outbound", "Calls gebucht"]] },
  { title: "Sales-Calls", roles: ["closer", "both", "setter"], fields: [["calendar_calls", "Calls im Kalender"], ["no_shows", "No-Shows"], ["reschedules", "Verschoben"], ["cancellations", "Absagen"]] },
  { title: "Abschlüsse", roles: ["closer", "both"], fields: [["one_call_closes", "One-Call-Closes"], ["followup_sales", "Follow-up-Sales"], ["upsell_conversations", "Upsell-Gespräche"], ["upsells", "Upsells"], ["deposits", "Anzahlungen"]] },
];

function parseMoney(s: string): number {
  const n = Number(s.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
const fmt = (n: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(Math.round(n));

export function CheckinForm({ day, initial, salesRole, commissionPct, monthCommissionOther, commissionGoal }: {
  day: string;
  initial: Values;
  salesRole: SalesRole;
  commissionPct: number;
  monthCommissionOther: number;
  commissionGoal: number;
}) {
  const [v, setV] = useState<Values>(initial);
  const [state, action, pending] = useActionState<FormState, FormData>(saveDaily, undefined);
  const [dirty, setDirty] = useState(false);

  const set = (k: DailyCountField, n: number) => {
    setDirty(true);
    setV((s) => ({ ...s, [k]: Math.max(0, Math.min(10000, Math.round(n) || 0)) }));
  };

  const summary = useMemo(() => {
    const held = Math.max(0, v.calendar_calls - v.no_shows - v.reschedules - v.cancellations);
    const sales = v.one_call_closes + v.followup_sales + v.upsells;
    const denom = held + v.upsell_conversations;
    const cash = parseMoney(v.cash_collected);
    const prov = (cash * commissionPct) / 100;
    return { held, sales, rate: denom > 0 ? `${Math.round((sales / denom) * 100)} %` : "–", prov, month: monthCommissionOther + prov };
  }, [v, commissionPct, monthCommissionOther]);

  const showMoney = salesRole !== "setter";
  const saved = state?.ok && !dirty;

  return (
    <form action={(fd) => { setDirty(false); return action(fd); }} className="stack lg" style={{ maxWidth: 560 }}>
      <input type="hidden" name="day" value={day} />
      {GROUPS.filter((g) => g.roles.includes(salesRole)).map((g) => (
        <div key={g.title} className="stack sm">
          <span className="label" style={{ padding: "0 16px" }}>{g.title}</span>
          <div className="list-card">
            {g.fields.map(([k, label]) => (
              <div key={k} className="list-row">
                <label htmlFor={`f-${k}`} className="grow" style={{ fontSize: 15 }}>{label}</label>
                <div className="stepper">
                  <button type="button" aria-label={`${label} verringern`} onClick={() => set(k, v[k] - 1)}><IconMinus width={14} height={14} /></button>
                  <input id={`f-${k}`} name={k} inputMode="numeric" value={v[k]} onChange={(e) => set(k, Number(e.target.value.replace(/\D/g, "")))} onFocus={(e) => e.target.select()} />
                  <button type="button" aria-label={`${label} erhöhen`} onClick={() => set(k, v[k] + 1)}><IconPlusSmall width={14} height={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {!GROUPS[2].roles.includes(salesRole) && GROUPS[2].fields.map(([k]) => <input key={k} type="hidden" name={k} value={v[k]} />)}
      {salesRole === "closer" && GROUPS[0].fields.map(([k]) => <input key={k} type="hidden" name={k} value={v[k]} />)}

      {showMoney ? (
        <div className="stack sm">
          <span className="label" style={{ padding: "0 16px" }}>Umsatz</span>
          <div className="list-card">
            {(["order_volume", "cash_collected"] as const).map((k) => (
              <div key={k} className="list-row" style={{ paddingRight: 16 }}>
                <label htmlFor={`f-${k}`} className="grow" style={{ fontSize: 15 }}>{k === "order_volume" ? "Auftragsvolumen" : "Cash collected"}</label>
                <input
                  id={`f-${k}`}
                  name={k}
                  className="num-input"
                  inputMode="decimal"
                  value={v[k]}
                  placeholder="0"
                  onChange={(e) => { setDirty(true); setV((s) => ({ ...s, [k]: e.target.value.replace(/[^\d.,]/g, "") })); }}
                  onBlur={(e) => setV((s) => ({ ...s, [k]: e.target.value ? fmt(parseMoney(e.target.value)) : "" }))}
                />
                <span className="muted" style={{ fontSize: 17 }}>€</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <input type="hidden" name="order_volume" value={v.order_volume} />
          <input type="hidden" name="cash_collected" value={v.cash_collected} />
        </>
      )}

      <div className="card ink" style={{ gap: 16, padding: "22px 20px" }}>
        <span className="small strong" style={{ color: "var(--on-ink-muted)" }}>Dein Tag, automatisch berechnet</span>
        <div className="grid-3" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
          <div className="stack" style={{ gap: 2 }}><span style={{ fontSize: 22, fontWeight: 700 }}>{summary.held}</span><span className="small" style={{ color: "var(--on-ink-muted)" }}>Calls geführt</span></div>
          <div className="stack" style={{ gap: 2 }}><span style={{ fontSize: 22, fontWeight: 700 }}>{summary.sales}</span><span className="small" style={{ color: "var(--on-ink-muted)" }}>Sales</span></div>
          <div className="stack" style={{ gap: 2 }}><span style={{ fontSize: 22, fontWeight: 700 }}>{summary.rate}</span><span className="small" style={{ color: "var(--on-ink-muted)" }}>Closing-Rate</span></div>
        </div>
        {showMoney && (
          <>
            <div style={{ height: 1, background: "#3a3a3c" }} />
            <div className="row between" style={{ alignItems: "baseline" }}>
              <span style={{ color: "#d1d1d6" }}>Provision ({String(commissionPct).replace(".", ",")} %)</span>
              <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em" }}>{fmt(summary.prov)} €</span>
            </div>
            <span className="small" style={{ color: "var(--on-ink-muted)" }}>Monat damit: {fmt(summary.month)} € von {fmt(commissionGoal)} €</span>
          </>
        )}
      </div>

      {state?.error && <p className="form-error" role="alert">{state.error}</p>}
      <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={pending}>
        {pending ? "Speichert …" : saved ? "Gespeichert ✓" : "Tag speichern"}
      </button>
    </form>
  );
}
