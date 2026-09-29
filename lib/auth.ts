import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

/** Aktuelle Session + Profil (pro Request einmal geladen) */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null as Profile | null };
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  return { supabase, user, profile: profile ?? null };
});

export async function requireUser() {
  const s = await getSession();
  if (!s.user || !s.profile) redirect("/login");
  return { supabase: s.supabase, user: s.user, profile: s.profile };
}

/** Für Teilnehmer-Seiten: Coach wird zur Coach-Übersicht geschickt, neue Teilnehmer ins Onboarding */
export async function requireParticipant() {
  const s = await requireUser();
  if (s.profile.role === "coach") redirect("/coach");
  if (!s.profile.onboarded_at) redirect("/onboarding");
  return s;
}

export async function requireCoach() {
  const s = await requireUser();
  if (s.profile.role !== "coach") redirect("/");
  return s;
}
