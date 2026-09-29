import { requireUser } from "@/lib/auth";
import { normalizeProfile } from "@/lib/data";
import { planGoal } from "@/lib/metrics";
import { int, euro } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { saveProfile } from "../actions";
import { updateInviteCode } from "../coach/actions";

export const metadata = { title: "Einstellungen" };

export default async function SettingsPage() {
  const { supabase, profile: raw, user } = await requireUser();
  const profile = normalizeProfile(raw);
  const isCoach = profile.role === "coach";

  if (isCoach) {
    const { data: settings } = await supabase.from("app_settings").select("invite_code").single();
    return (
      <>
        <header className="page-head"><div><h1 className="h1">Einstellungen</h1></div></header>
        <div className="grid-2">
          <section className="card">
            <div className="stack sm">
              <h2 className="h2">Einladungscode</h2>
              <span className="sub">Diesen Code geben neue Teilnehmer bei der Registrierung ein. Wenn du ihn änderst, funktioniert der alte nicht mehr. Bestehende Konten sind nicht betroffen.</span>
            </div>
            <ActionForm action={updateInviteCode} submit="Code speichern">
              <label className="field"><span>Aktueller Code</span><input className="input" name="invite_code" defaultValue={settings?.invite_code ?? ""} style={{ fontWeight: 600, letterSpacing: "0.04em" }} /></label>
            </ActionForm>
          </section>
          <section className="card">
            <div className="stack sm"><h2 className="h2">Dein Profil</h2><span className="sub">{user.email}</span></div>
            <ActionForm action={saveProfile} submit="Speichern">
              <label className="field"><span>Name</span><input className="input" name="full_name" defaultValue={profile.full_name} /></label>
            </ActionForm>
          </section>
        </div>
      </>
    );
  }

  const plan = planGoal({
    commissionGoal: profile.commission_goal,
    commissionPct: profile.commission_pct,
    avgCashPerSale: profile.avg_cash_per_sale,
    showupPct: profile.assumed_showup_pct,
    closePct: profile.assumed_close_pct,
  });

  return (
    <>
      <header className="page-head"><div><span className="sub">{user.email}</span><h1 className="h1">Ziele &amp; Profil</h1></div></header>
      <div className="split">
        <section className="card wide" style={{ flex: "2 1 0" }}>
          <ActionForm action={saveProfile} submit="Speichern" className="stack lg">
            <div className="grid-2">
              <label className="field"><span>Name</span><input className="input" name="full_name" defaultValue={profile.full_name} /></label>
              <label className="field"><span>Rolle im Vertrieb</span>
                <select className="select" name="sales_role" defaultValue={profile.sales_role}>
                  <option value="setter">Setting</option>
                  <option value="closer">Closing</option>
                  <option value="both">Setting &amp; Closing</option>
                </select>
              </label>
            </div>
            <div className="divider" />
            <div className="stack sm"><h2 className="h2">Monatsziel</h2><span className="sub">Daraus rechnet die App rückwärts, was du pro Woche brauchst.</span></div>
            <div className="grid-2">
              <label className="field"><span>Provisionsziel pro Monat (€)</span><input className="input" name="commission_goal" inputMode="numeric" defaultValue={profile.commission_goal} /></label>
              <label className="field"><span>Deine Provision (%)</span><input className="input" name="commission_pct" inputMode="decimal" defaultValue={String(profile.commission_pct).replace(".", ",")} /></label>
              <label className="field"><span>Ø Cash collected pro Sale (€)</span><input className="input" name="avg_cash_per_sale" inputMode="numeric" defaultValue={profile.avg_cash_per_sale} /></label>
              <label className="field"><span>Slots für Sales-Calls pro Woche</span><input className="input" name="weekly_slots" inputMode="numeric" defaultValue={profile.weekly_slots} /></label>
              <label className="field"><span>Angenommene Showup-Rate (%)</span><input className="input" name="assumed_showup_pct" inputMode="numeric" defaultValue={profile.assumed_showup_pct} /></label>
              <label className="field"><span>Angenommene Closing-Rate (%)</span><input className="input" name="assumed_close_pct" inputMode="numeric" defaultValue={profile.assumed_close_pct} /></label>
            </div>
            <span className="small muted">Neue Prozentsätze gelten ab dem nächsten gespeicherten Tag. Bereits eingetragene Tage behalten ihre Provision.</span>
          </ActionForm>
        </section>
        <aside className="card ink narrow" style={{ flex: "1 1 0", gap: 14 }}>
          <span className="small strong" style={{ color: "var(--on-ink-muted)" }}>DAS BRAUCHST DU PRO WOCHE</span>
          {[
            ["Cash collected", euro(plan.perWeek.cash)],
            ["Sales", int(Math.ceil(plan.perWeek.sales))],
            ["Sales-Calls geführt", int(Math.ceil(plan.perWeek.callsHeld))],
            ["Sales-Calls im Kalender", int(Math.ceil(plan.perWeek.callsBooked))],
          ].map(([l, v]) => (
            <div key={l} className="row between" style={{ alignItems: "baseline" }}>
              <span style={{ color: "#d1d1d6" }}>{l}</span>
              <span style={{ fontSize: 22, fontWeight: 700 }}>{v}</span>
            </div>
          ))}
        </aside>
      </div>
    </>
  );
}
