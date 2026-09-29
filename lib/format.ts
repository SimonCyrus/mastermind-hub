const intFmt = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const oneDec = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function euro(n: number): string {
  return `${intFmt.format(Math.round(n))} €`;
}

export function int(n: number): string {
  return intFmt.format(Math.round(n));
}

export function dec1(n: number): string {
  return oneDec.format(n);
}

/** Anteil 0..1 → "31 %"; null → "–" */
export function pct(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "–";
  return `${intFmt.format(Math.round(ratio * 100))} %`;
}

/** Differenz in Prozentpunkten zwischen zwei Anteilen → "+3 Pp." */
export function ppDelta(current: number | null, previous: number | null): { text: string; sign: -1 | 0 | 1 } | null {
  if (current === null || previous === null) return null;
  const d = Math.round((current - previous) * 100);
  if (d === 0) return { text: "±0 Pp.", sign: 0 };
  return { text: `${d > 0 ? "+" : "−"}${Math.abs(d)} Pp.`, sign: d > 0 ? 1 : -1 };
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] || "Ohne Namen";
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "";
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
