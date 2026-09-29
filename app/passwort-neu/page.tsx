import { Brand } from "@/components/brand";
import { AuthForm } from "@/components/auth-form";
import { updatePassword } from "@/app/(auth)/actions";

export const metadata = { title: "Neues Passwort" };

export default function NewPasswordPage() {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Brand />
        <h1 className="h1">Neues Passwort festlegen.</h1>
        <AuthForm action={updatePassword} submit="Speichern" fields={[{ name: "password", label: "Neues Passwort (mind. 8 Zeichen)", type: "password", autoComplete: "new-password" }]} />
      </div>
    </div>
  );
}
