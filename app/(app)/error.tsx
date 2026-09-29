"use client";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card empty">
      <span className="h3">Da ist etwas schiefgelaufen</span>
      <span className="sub">Bitte lade die Seite neu. Wenn es wieder passiert, sag deinem Coach Bescheid.</span>
      <button className="btn btn-primary" onClick={reset}>Nochmal versuchen</button>
    </div>
  );
}
