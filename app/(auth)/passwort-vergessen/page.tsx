import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { requestPasswordReset } from "../actions";

export const metadata = { title: "Passwort vergessen" };

export default function ForgotPage() {
  return (
    <>
      <div className="stack sm">
        <h1 className="h1">Passwort vergessen?</h1>
        <p className="sub">Wir schicken dir einen Link, mit dem du ein neues festlegst.</p>
      </div>
      <AuthForm action={requestPasswordReset} submit="Link senden" fields={[{ name: "email", label: "E-Mail", type: "email", autoComplete: "email" }]} />
      <p className="small"><Link href="/login">Zurück zur Anmeldung</Link></p>
    </>
  );
}
