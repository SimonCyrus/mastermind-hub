import type { Bottleneck } from "@/lib/types";
import type { WeekPoint } from "@/lib/metrics";
import { addDays, dayOf, isoWeek } from "@/lib/dates";
import { pad2 } from "@/lib/format";

/** Closing-Rate pro Woche, hinterlegt mit den Engpass-Phasen */
export function ClosingChart({ series, bottlenecks, today }: { series: WeekPoint[]; bottlenecks: Bottleneck[]; today: string }) {
  const W = 640, H = 240, L = 38, R = 632, T = 60, B = 200;
  const n = series.length;
  const vals = series.map((p) => p.closeRate).filter((v): v is number => v !== null);
  if (vals.length === 0) {
    return (
      <div className="empty" style={{ padding: "56px 24px" }}>
        <span className="h3">Noch keine Daten für den Verlauf</span>
        <span className="sub">Sobald du ein paar Tage eingetragen hast, siehst du hier deine Closing-Rate Woche für Woche.</span>
      </div>
    );
  }
  const lo = Math.max(0, Math.floor((Math.min(...vals) - 0.03) * 20) / 20);
  const hi = Math.min(1, Math.max(lo + 0.1, Math.ceil((Math.max(...vals) + 0.03) * 20) / 20));
  const step = hi - lo > 0.3 ? 0.1 : 0.05;
  const y = (v: number) => B - ((v - lo) / (hi - lo)) * (B - T);
  const inner = 30;
  const dx = n > 1 ? (R - L - 2 * inner) / (n - 1) : 0;
  const x = (i: number) => L + inner + i * dx;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);

  // Engpass-Phasen als Bänder
  const firstWeek = series[0].weekStart;
  const lastWeekEnd = addDays(series[n - 1].weekStart, 6);
  const dayToX = (day: string) => {
    const idx = series.findIndex((p) => day >= p.weekStart && day <= addDays(p.weekStart, 6));
    if (idx >= 0) {
      const within = (Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) - Date.UTC(+series[idx].weekStart.slice(0, 4), +series[idx].weekStart.slice(5, 7) - 1, +series[idx].weekStart.slice(8, 10))) / 86400000;
      return x(idx) - dx / 2 + (within / 7) * dx;
    }
    return day < firstWeek ? L : R;
  };
  const phases = bottlenecks
    .filter((b) => b.activated_at && (b.status === "active" || b.status === "solved"))
    .map((b) => {
      const start = dayOf(b.activated_at!);
      const end = b.solved_at ? dayOf(b.solved_at) : today;
      if (end < firstWeek || start > lastWeekEnd) return null;
      const x1 = Math.max(L, dayToX(start));
      const x2 = Math.min(R, dayToX(end) + dx / 7);
      return { b, x1, x2 };
    })
    .filter((p): p is { b: Bottleneck; x1: number; x2: number } => !!p && p.x2 - p.x1 > 2);

  const pts = series.map((p, i) => (p.closeRate === null ? null : { x: x(i), y: y(p.closeRate), v: p.closeRate })).filter((p): p is { x: number; y: number; v: number } => !!p);
  const last = pts[pts.length - 1];

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gesamt-Closing-Rate pro Woche mit Engpass-Phasen" style={{ display: "block" }}>
      {phases.map(({ b, x1, x2 }, i) => {
        const active = b.status === "active";
        const label = `${pad2(b.seq)} ${b.title}`;
        const maxChars = Math.floor((x2 - x1 - 16) / 6.6);
        return (
          <g key={b.id}>
            <rect x={x1} y={30} width={x2 - x1} height={B - 30} fill={active ? "#e8f1fc" : i % 2 ? "#eeeef2" : "#f5f5f7"} />
            {maxChars >= 4 && (
              <text x={x1 + 10} y={50} fontSize={12} fontWeight={600} fill={active ? "#0071e3" : "#6e6e73"}>
                {label.length > maxChars ? label.slice(0, maxChars - 1) + "…" : label}
              </text>
            )}
          </g>
        );
      })}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={R} y1={y(t)} y2={y(t)} stroke={phases.length ? "#ffffff" : "#e5e5ea"} strokeWidth={1.5} />
          <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#8e8e93">{Math.round(t * 100)} %</text>
        </g>
      ))}
      {pts.length > 1 && (
        <polyline points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#1d1d1f" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
      )}
      {pts.map((p, i) => (i === pts.length - 1 ? null : <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#1d1d1f" />))}
      {last && (
        <>
          <circle cx={last.x} cy={last.y} r={5} fill="#0071e3" stroke="#fff" strokeWidth={2.5} />
          <text x={last.x} y={last.y - 12} textAnchor="end" fontSize={13} fontWeight={700} fill="#1d1d1f">{Math.round(last.v * 100)} %</text>
        </>
      )}
      {series.map((p, i) =>
        i % 3 === (n - 1) % 3 ? (
          <text key={p.weekStart} x={x(i)} y={222} textAnchor="middle" fontSize={11} fill="#8e8e93">KW {isoWeek(p.weekStart)}</text>
        ) : null
      )}
    </svg>
  );
}

/** Kleine Linie der Engpass-Messgröße (Scores 1–10) */
export function ScoreChart({ scores, target }: { scores: number[]; target: number | null }) {
  const W = 420, H = 140, top = 16, bottom = 128;
  if (scores.length === 0) {
    return <p className="sub" style={{ padding: "24px 0" }}>Noch keine Bewertungen. Nach jedem Call fragt dich die Reflexion danach.</p>;
  }
  const xs = scores.slice(-15);
  const y = (v: number) => bottom - ((v - 1) / 9) * (bottom - top);
  const dx = xs.length > 1 ? (W - 20) / (xs.length - 1) : 0;
  const pts = xs.map((v, i) => ({ x: 10 + i * dx, y: y(v) }));
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Letzte ${xs.length} Bewertungen`} style={{ display: "block" }}>
      {target !== null && (
        <>
          <line x1={0} x2={W} y1={y(target)} y2={y(target)} stroke="#0071e3" strokeWidth={1} strokeDasharray="4 4" />
          <text x={W} y={y(target) - 6} textAnchor="end" fontSize={11} fontWeight={600} fill="#0071e3">Ziel {String(target).replace(".", ",")}</text>
        </>
      )}
      <line x1={0} x2={W} y1={bottom + 2} y2={bottom + 2} stroke="#e5e5ea" />
      {pts.length > 1 && <polyline points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#1d1d1f" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 4.5 : 2.5} fill={i === pts.length - 1 ? "#0071e3" : "#1d1d1f"} stroke={i === pts.length - 1 ? "#fff" : "none"} strokeWidth={2} />
      ))}
    </svg>
  );
}

/** Balken der letzten Scores (kompakt, für die Engpass-Karte) */
export function ScoreBars({ scores, target }: { scores: number[]; target: number | null }) {
  const xs = scores.slice(-10);
  if (xs.length === 0) return null;
  const W = 300, H = 56, bw = 24, gap = (W - bw * 10) / 9;
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Letzte Bewertungen" style={{ display: "block" }}>
      {target !== null && <line x1={0} x2={W} y1={H - (target / 10) * H} y2={H - (target / 10) * H} stroke="#0071e3" strokeWidth={1} strokeDasharray="3 3" />}
      {xs.map((v, i) => {
        const h = Math.max(4, (v / 10) * H);
        const reached = target !== null && v >= target;
        return <rect key={i} x={i * (bw + gap)} y={H - h} width={bw} height={h} rx={4} fill={reached ? "#0071e3" : i >= xs.length - 3 ? "#8e8e93" : "#d1d1d6"} />;
      })}
    </svg>
  );
}

export function Sparkline({ values, color = "#0071e3" }: { values: number[]; color?: string }) {
  if (values.length < 2) return <span className="muted small">–</span>;
  const W = 64, H = 22;
  const lo = Math.min(...values), hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => `${2 + (i * (W - 4)) / (values.length - 1)},${H - 3 - ((v - lo) / span) * (H - 6)}`).join(" ");
  return (
    <svg width={56} height={20} viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
