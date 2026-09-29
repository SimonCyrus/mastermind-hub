import { Brand } from "@/components/brand";

export const dynamic = "force-dynamic";
export const metadata = { title: "Einrichtung" };

function check(value: string | undefined, kind: "url" | "key") {
  if (!value) return { ok: false, text: "fehlt" };
  if (kind === "url") {
    try {
      const u = new URL(value);
      if (!u.hostname.endsWith(".supabase.co")) return { ok: false, text: `gesetzt, sieht aber ungewöhnlich aus: ${u.hostname}` };
      if (u.pathname !== "/" && u.pathname !== "") return { ok: false, text: "bitte nur https://….supabase.co ohne Zusatz am Ende" };
      return { ok: true, text: "in Ordnung" };
    } catch {
      return { ok: false, text: "keine gültige Adresse (muss mit https:// beginnen)" };
    }
  }
  return value.length > 20 ? { ok: true, text: "in Ordnung" } : { ok: false, text: "zu kurz, bitte den ganzen Schlüssel kopieren" };
}

export default function SetupPage() {
  const url = check(process.env.NEXT_PUBLIC_SUPABASE_URL, "url");
  const key = check(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "key");
  const rows = [
    ["NEXT_PUBLIC_SUPABASE_URL", url],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", key],
  ] as const;
  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ maxWidth: 560 }}>
        <Brand />
        <h1 className="h1">Fast geschafft.</h1>
        <p className="sub">Die App ist online, aber die Verbindung zur Datenbank ist noch nicht eingerichtet.</p>
        <div className="list-card">
          {rows.map(([name, r]) => (
            <div key={name} className="list-row" style={{ paddingRight: 16 }}>
              <code className="grow small" style={{ fontWeight: 600 }}>{name}</code>
              <span className={`pill ${r.ok ? "good" : "warn"}`}>{r.text}</span>
            </div>
          ))}
        </div>
        <ol className="sub" style={{ paddingLeft: 18, lineHeight: 1.7, margin: 0 }}>
          <li>In Vercel: Projekt → <b>Settings → Environment Variables</b>. Namen exakt wie oben, Werte aus Supabase (Connect → Next.js).</li>
          <li>Danach: <b>Deployments</b> → beim obersten Eintrag „…“ → <b>Redeploy</b>. Ohne neues Deployment übernimmt die App die Werte nicht.</li>
        </ol>
      </div>
    </div>
  );
}
