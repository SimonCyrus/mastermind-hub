import Link from "next/link";

export default function NotFound() {
  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ textAlign: "center", alignItems: "center" }}>
        <h1 className="h1">Seite nicht gefunden</h1>
        <p className="sub">Diese Seite gibt es nicht oder du hast keinen Zugriff darauf.</p>
        <Link className="btn btn-primary" href="/">Zur Übersicht</Link>
      </div>
    </div>
  );
}
