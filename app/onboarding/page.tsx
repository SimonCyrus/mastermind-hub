import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { firstName } from "@/lib/format";
import { OnboardingWizard } from "@/components/onboarding-wizard";

export const metadata = { title: "Willkommen" };

export default async function OnboardingPage() {
  const { supabase, profile } = await requireUser();
  if (profile.role === "coach") redirect("/coach");
  if (profile.onboarded_at) redirect("/");
  const { data: coach } = await supabase.from("profiles").select("full_name").eq("role", "coach").limit(1).maybeSingle();
  return <OnboardingWizard firstName={firstName(profile.full_name)} coachName={coach?.full_name ?? ""} />;
}
