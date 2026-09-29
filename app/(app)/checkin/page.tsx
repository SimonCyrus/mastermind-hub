import Link from "next/link";
import { requireParticipant } from "@/lib/auth";
import { normalizeEntry, normalizeProfile } from "@/lib/data";
import { DAILY_COUNT_FIELDS, type DailyEntry } from "@/lib/types";
import { sumEntries } from "@/lib/metrics";
import { todayISO, addDays, formatLongDate, monthStart, monthEnd } from "@/lib/dates";
import { CheckinForm } from "@/components/checkin-form";
import { IconChevron, IconChevronLeft } from "@/components/icons";

export const metadata = { title: "Tages-Check-in" };

export default async function CheckinPage({ searchParams }: { searchParams: Promise<{ tag?: string }> }) {
  const { supabase, user, profile: raw } = await requireParticipant();
  const profile = normalizeProfile(raw);
  const today = todayISO();
  const { tag } = await searchParams;
  const day = tag && /^\d{4}-\d{2}-\d{2}$/.test(tag) && tag <= today && tag >= addDays(today, -60) ? tag : today;

  const [{ data: monthRows }, { data: active }] = await Promise.all([
    supabase.from("daily_entries").select("*").eq("participant_id", user.id).gte("day", monthStart(day)).lte("day", monthEnd(day)),
    supabase.from("bottlenecks").select("id, title").eq("participant_id", user.id).eq("status", "active").maybeSingle(),
  ]);
  const rows = ((monthRows ?? []) as DailyEntry[]).map(normalizeEntry);
  const existing = rows.find((r) => r.day === day);
  const otherCommission = sumEntries(rows.filter((r) => r.day !== day)).commission;

  const fmt = (n: number) => (n ? new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(n) : "");
  const initial = Object.fromEntries(DAILY_COUNT_FIELDS.map((f) => [f, existing ? Number(existing[f]) : 0])) as Record<(typeof DAILY_COUNT_FIELDS)[number], number>;

  return (
    <div className="stack lg" style={{ maxWidth: 560 }}>
      <header className="stack sm">
        <div className="row between">
          <Link href={`/checkin?tag=${addDays(day, -1)}`} className="btn btn-soft btn-sm" aria-label="Vorheriger Tag"><IconChevronLeft width={14} height={14} /></Link>
          <span className="sub" style={{ fontWeight: 600 }}>{day === today ? `Heute · ${formatLongDate(day)}` : formatLongDate(day)}</span>
          {day < today ? (
            <Link href={`/checkin?tag=${addDays(day, 1)}`} className="btn btn-soft btn-sm" aria-label="Nächster Tag"><IconChevron width={14} height={14} /></Link>
          ) : (
            <span style={{ width: 42 }} />
          )}
        </div>
        <h1 className="h1">Check-in</h1>
      </header>

      <div className="segmented" role="tablist">
        <span className="on" role="tab" aria-selected="true">Tageszahlen</span>
        <Link href="/reflexion" role="tab" aria-selected="false">Call-Reflexion</Link>
      </div>

      {active && (
        <Link href="/engpass" className="list-card" style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 14, color: "var(--text)" }}>
          <div className="stack" style={{ gap: 4, flex: 1 }}>
            <span className="eyebrow" style={{ fontSize: 11 }}>Dein Engpass</span>
            <span className="h3">{active.title}</span>
            <span className="small muted">Nach jedem Call kurz reflektieren, das füttert deine Messgröße.</span>
          </div>
          <IconChevron width={16} height={16} stroke="#c7c7cc" />
        </Link>
      )}

      {existing && <span className="small muted" style={{ padding: "0 4px" }}>Für diesen Tag gibt es schon Zahlen. Du bearbeitest sie.</span>}

      <CheckinForm
        key={day}
        day={day}
        initial={{ ...initial, order_volume: fmt(existing?.order_volume ?? 0), cash_collected: fmt(existing?.cash_collected ?? 0) }}
        salesRole={profile.sales_role}
        commissionPct={Number(profile.commission_pct)}
        monthCommissionOther={otherCommission}
        commissionGoal={profile.commission_goal}
      />
    </div>
  );
}
