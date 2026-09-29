import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { signUp } from "../actions";

export const metadata = { title: "Konto erstellen" };

export default function SignUpPage() {
  return (
    <>
      <div className="stack sm">
        <h1 className="h1">Willkommen im Mastermind.</h1>
        <p className="sub">Den Einladungscode bekommst du von deinem Coach.</p>
      </div>
      <AuthForm
        action={signUp}
        submit="Konto erstellen"
        fields={[
          { name: "full_name", label: "Vor- und Nachname", autoComplete: "name" },
          { name: "email", label: "E-Mail", type: "email", autoComplete: "email" },
          { name: "password", label: "Passwort (mind. 8 Zeichen)", type: "password", autoComplete: "new-password" },
          { name: "invite_code", label: "Einladungscode", autoComplete: "off" },
        ]}
      />
      <p className="small muted">
        Schon ein Konto? <Link href="/login">Anmelden</Link>
      </p>
    </>
  );
}
