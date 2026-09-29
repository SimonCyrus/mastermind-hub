import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { signIn } from "../actions";

export const metadata = { title: "Anmelden" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const { fehler } = await searchParams;
  return (
    <>
      <div className="stack sm">
        <h1 className="h1">Willkommen zurück.</h1>
        <p className="sub">Melde dich an, um mit deinem Trainingsplan weiterzumachen.</p>
      </div>
      {fehler === "link" && <p className="form-error">Der Link ist abgelaufen oder ungültig. Bitte fordere einen neuen an.</p>}
      <AuthForm
        action={signIn}
        submit="Anmelden"
        fields={[
          { name: "email", label: "E-Mail", type: "email", autoComplete: "email" },
          { name: "password", label: "Passwort", type: "password", autoComplete: "current-password" },
        ]}
      />
      <div className="row between small">
        <Link href="/passwort-vergessen">Passwort vergessen?</Link>
        <Link href="/registrieren">Neu hier? Konto erstellen</Link>
      </div>
    </>
  );
}
