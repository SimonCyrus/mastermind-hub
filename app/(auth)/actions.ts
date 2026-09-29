"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; ok?: string } | undefined;

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

function str(fd: FormData, k: string) {
  return String(fd.get(k) ?? "").trim();
}

export async function signIn(_: AuthState, fd: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: str(fd, "email"), password: String(fd.get("password") ?? "") });
  if (error) {
    if (error.message.toLowerCase().includes("confirm")) return { error: "Bitte bestätige zuerst deine E-Mail-Adresse (Link in deinem Postfach)." };
    return { error: "E-Mail oder Passwort stimmt nicht." };
  }
  redirect("/");
}

export async function signUp(_: AuthState, fd: FormData): Promise<AuthState> {
  const fullName = str(fd, "full_name");
  const email = str(fd, "email");
  const password = String(fd.get("password") ?? "");
  const inviteCode = str(fd, "invite_code");
  if (fullName.length < 2) return { error: "Bitte gib deinen vollen Namen ein." };
  if (password.length < 8) return { error: "Das Passwort braucht mindestens 8 Zeichen." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, invite_code: inviteCode },
      emailRedirectTo: `${await origin()}/auth/callback?next=/onboarding`,
    },
  });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("database error") || m.includes("einladungscode")) return { error: "Der Einladungscode ist ungültig. Frag deinen Coach nach dem aktuellen Code." };
    if (m.includes("already")) return { error: "Mit dieser E-Mail gibt es schon ein Konto. Melde dich an." };
    return { error: "Registrierung fehlgeschlagen. Bitte versuch es noch einmal." };
  }
  if (data.session) redirect("/onboarding");
  return { ok: "Fast geschafft: Wir haben dir eine E-Mail geschickt. Klick auf den Link darin, um dein Konto zu bestätigen." };
}

export async function requestPasswordReset(_: AuthState, fd: FormData): Promise<AuthState> {
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(str(fd, "email"), {
    redirectTo: `${await origin()}/auth/callback?next=/passwort-neu`,
  });
  return { ok: "Wenn es ein Konto mit dieser E-Mail gibt, ist der Link zum Zurücksetzen jetzt unterwegs." };
}

export async function updatePassword(_: AuthState, fd: FormData): Promise<AuthState> {
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) return { error: "Das Passwort braucht mindestens 8 Zeichen." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Das hat nicht geklappt. Fordere bitte einen neuen Link an." };
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
