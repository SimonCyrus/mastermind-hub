import Link from "next/link";
import { requireParticipant } from "@/lib/auth";
import { loadParticipant, normalizeProfile } from "@/lib/data";
import { sumEntries, rates, inRange, weeklySeries, objectionStats, weakestObjection, scoresFor } from "@/lib/metrics";
import { todayISO, monthStart, monthEnd, prevMonthStart, addDays, formatLongDate, greeting } from "@/lib/dates";
import { firstName } from "@/lib/format";
import { BottleneckHero, KpiTiles, FunnelCard, ObjectionCard, HistoryCard } from "@/components/dashboard";
import { ClosingChart } from "@/components/charts";

export const metadata = { title: "Übersicht" };

export default async function DashboardPage() {
  const { supabase, user, profile: rawProfile } = await requireParticipant();
  const profile = normalizeProfile(rawProfile);
  const today = todayISO();
  const data = await loadParticipant(supabase, user.id, today);
  const { data: coach } = await supabase.from("profiles").select("full_name").eq("role", "coach").limit(1).maybeSingle();

  const mStart = monthStart(today);
  const pStart = prevMonthStart(today);
  const month = sumEntries(inRange(data.entries, mStart, monthEnd(today)));
  const prev = sumEntries(inRange(data.entries, pStart, addDays(mStart, -1)));
  const current = data.active ?? data.proposed;
  const scores = current ? scoresFor(data.reflections, current.id) : [];
  const stats = objectionStats(data.reflections.filter((r) => r.day >= addDays(today, -60)));
  const weakest = weakestObjection(stats);
  const checkedInToday = data.entries.some((e) => e.day === today);

  return (
    <>
      <header className="page-head">
        <div>
          <span className="sub" style={{ fontWeight: 500 }}>{formatLongDate(today)}</span>
          <h1 className="h1">{greeting()}, {firstName(profile.full_name) || "du"}.</h1>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <Link className="btn btn-ghost" href="/reflexion">Call reflektieren</Link>
          <Link className="btn btn-primary" href="/checkin">{checkedInToday ? "Check-in bearbeiten" : "Tages-Check-in"}</Link>
        </div>
      </header>

      <BottleneckHero
        bottleneck={current}
        drills={data.drills}
        logs={data.logs}
        today={today}
        scores={scores}
        interactive
        coachName={coach?.full_name || undefined}
        detailHref="/engpass"
      />

      <KpiTiles profile={profile} month={month} monthRates={rates(month, profile.weekly_slots * 4)} prevRates={rates(prev)} today={today} />

      <section className="split">
        <div className="card wide" style={{ flex: "2 1 0" }}>
          <div className="card-head">
            <div>
              <h3 className="h2">Deine Closing-Rate, Engpass für Engpass</h3>
              <span className="sub">Letzte 12 Wochen · Gesamt-Closing-Rate pro Woche</span>
            </div>
          </div>
          <ClosingChart series={weeklySeries(data.entries, today, 12)} bottlenecks={data.bottlenecks} today={today} />
        </div>
        <FunnelCard t={month} r={rates(month)} salesRole={profile.sales_role} today={today} />
      </section>

      <section className="split">
        <ObjectionCard
          stats={stats}
          weakest={weakest}
          action={!data.proposed ? <Link className="btn btn-dark btn-sm" href="/engpass#vorschlagen">Vorschlagen</Link> : undefined}
        />
        <HistoryCard bottlenecks={data.bottlenecks} entries={data.entries} today={today} />
      </section>
    </>
  );
}
