"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCoach } from "@/lib/auth";
import type { BottleneckTemplate, Criterion, Evidence, TemplateDrill } from "@/lib/types";
import type { FormState } from "../actions";

const s = (fd: FormData, k: string, max = 4000) => String(fd.get(k) ?? "").trim().slice(0, max);

function revalidateParticipant(pid?: string) {
  if (pid) revalidatePath(`/coach/teilnehmer/${pid}`);
  revalidatePath("/coach");
  revalidatePath("/");
  revalidatePath("/engpass");
}

async function participantOf(bottleneckId: string) {
  const { supabase } = await requireCoach();
  const { data } = await supabase.from("bottlenecks").select("participant_id, status, criteria").eq("id", bottleneckId).single();
  return { supabase, row: data as { participant_id: string; status: string; criteria: Criterion[] } | null };
}

/** "Text | Quelle" pro Zeile → Evidence[] */
function parseEvidence(raw: string): Evidence[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((l) => {
      const [text, ...src] = l.split("|");
      return { text: text.trim().slice(0, 300), source: src.join("|").trim().slice(0, 120) };
    });
}

function parseLines(raw: string, max = 12): string[] {
  return raw.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, max).map((l) => l.slice(0, 200));
}

function parseTarget(v: string): number | null {
  if (!v) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 1 && n <= 10 ? Math.round(n * 10) / 10 : null;
}

// ---------------------------------------------------------------------
// Engpass anlegen (aus Vorlage oder leer)
// ---------------------------------------------------------------------
export async function createBottleneck(participantId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user } = await requireCoach();
  const templateId = s(fd, "template_id");
  const activate = fd.get("activate") === "1";
  if (activate) {
    const { count } = await supabase.from("bottlenecks").select("id", { count: "exact", head: true }).eq("participant_id", participantId).eq("status", "active");
    if ((count ?? 0) > 0) return { error: "Es gibt schon einen aktiven Engpass. Markiere ihn zuerst als gelöst." };
  }
  let tpl: BottleneckTemplate | null = null;
  if (templateId) {
    const { data } = await supabase.from("bottleneck_templates").select("*").eq("id", templateId).single<BottleneckTemplate>();
    tpl = data ?? null;
  }
  const now = new Date().toISOString();
  const { data: b, error } = await supabase
    .from("bottlenecks")
    .insert({
      participant_id: participantId,
      template_id: tpl?.id ?? null,
      title: s(fd, "title", 120) || tpl?.name || "Neuer Engpass",
      why: "",
      metric_label: tpl?.metric_label ?? "",
      reflection_question: tpl?.reflection_question ?? "",
      target_score: tpl?.target_score ?? null,
      criteria: (tpl?.criteria ?? []).map((label) => ({ label, done: false })),
      status: activate ? "active" : "proposed",
      proposed_by: user.id,
      activated_by: activate ? user.id : null,
      activated_at: activate ? now : null,
    })
    .select("id")
    .single();
  if (error || !b) return { error: "Konnte den Engpass nicht anlegen." };
  if (tpl?.drills?.length) {
    await supabase.from("drills").insert(tpl.drills.map((d, i) => ({ bottleneck_id: b.id, title: d.title, description: d.description, cadence: d.cadence, duration: d.duration, sort_order: i })));
  }
  revalidateParticipant(participantId);
  return { ok: "Angelegt" };
}

// ---------------------------------------------------------------------
// Engpass bearbeiten
// ---------------------------------------------------------------------
export async function updateBottleneck(bottleneckId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase, row } = await participantOf(bottleneckId);
  if (!row) return { error: "Nicht gefunden." };
  const oldCriteria = new Map((row.criteria ?? []).map((c) => [c.label, c.done]));
  const criteria = parseLines(s(fd, "criteria")).map((label) => ({ label, done: oldCriteria.get(label) ?? false }));
  const { error } = await supabase
    .from("bottlenecks")
    .update({
      title: s(fd, "title", 120) || "Engpass",
      why: s(fd, "why"),
      evidence: parseEvidence(s(fd, "evidence")),
      metric_label: s(fd, "metric_label", 120),
      reflection_question: s(fd, "reflection_question", 200),
      target_score: parseTarget(s(fd, "target_score")),
      criteria,
    })
    .eq("id", bottleneckId);
  if (error) return { error: "Speichern hat nicht geklappt." };
  revalidateParticipant(row.participant_id);
  return { ok: "Gespeichert" };
}

export async function setCriterion(bottleneckId: string, index: number, done: boolean) {
  const { supabase, row } = await participantOf(bottleneckId);
  if (!row) return;
  const criteria = [...(row.criteria ?? [])];
  if (!criteria[index]) return;
  criteria[index] = { ...criteria[index], done };
  await supabase.from("bottlenecks").update({ criteria }).eq("id", bottleneckId);
  revalidateParticipant(row.participant_id);
}

export async function activateBottleneck(bottleneckId: string): Promise<FormState> {
  const { supabase, row } = await participantOf(bottleneckId);
  const { user } = await requireCoach();
  if (!row) return { error: "Nicht gefunden." };
  const { count } = await supabase.from("bottlenecks").select("id", { count: "exact", head: true }).eq("participant_id", row.participant_id).eq("status", "active");
  if ((count ?? 0) > 0) return { error: "Es gibt schon einen aktiven Engpass. Markiere ihn zuerst als gelöst." };
  await supabase.from("bottlenecks").update({ status: "active", activated_at: new Date().toISOString(), activated_by: user.id }).eq("id", bottleneckId);
  revalidateParticipant(row.participant_id);
  return { ok: "Aktiviert" };
}

export async function solveBottleneck(bottleneckId: string): Promise<FormState> {
  const { supabase, row } = await participantOf(bottleneckId);
  if (!row) return { error: "Nicht gefunden." };
  await supabase.from("bottlenecks").update({ status: "solved", solved_at: new Date().toISOString() }).eq("id", bottleneckId);
  revalidateParticipant(row.participant_id);
  return { ok: "Als gelöst markiert" };
}

export async function archiveBottleneck(bottleneckId: string): Promise<FormState> {
  const { supabase, row } = await participantOf(bottleneckId);
  if (!row) return { error: "Nicht gefunden." };
  await supabase.from("bottlenecks").update({ status: "archived" }).eq("id", bottleneckId);
  revalidateParticipant(row.participant_id);
  return { ok: "Verworfen" };
}

// ---------------------------------------------------------------------
// Drills
// ---------------------------------------------------------------------
export async function saveDrill(bottleneckId: string, drillId: string | null, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase, row } = await participantOf(bottleneckId);
  if (!row) return { error: "Nicht gefunden." };
  const values = {
    title: s(fd, "title", 120),
    description: s(fd, "description", 300),
    cadence: s(fd, "cadence", 60),
    duration: s(fd, "duration", 30),
  };
  if (!values.title) return { error: "Der Drill braucht einen Titel." };
  if (drillId) {
    await supabase.from("drills").update(values).eq("id", drillId);
  } else {
    const { count } = await supabase.from("drills").select("id", { count: "exact", head: true }).eq("bottleneck_id", bottleneckId);
    await supabase.from("drills").insert({ ...values, bottleneck_id: bottleneckId, sort_order: count ?? 0 });
  }
  revalidateParticipant(row.participant_id);
  return { ok: drillId ? "Gespeichert" : "Hinzugefügt" };
}

export async function deleteDrill(drillId: string, participantId: string) {
  const { supabase } = await requireCoach();
  await supabase.from("drills").delete().eq("id", drillId);
  revalidateParticipant(participantId);
}

// ---------------------------------------------------------------------
// Private Notizen
// ---------------------------------------------------------------------
export async function saveCoachNote(participantId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireCoach();
  const { error } = await supabase.from("coach_notes").upsert({ participant_id: participantId, body: s(fd, "body", 20000), updated_at: new Date().toISOString() });
  if (error) return { error: "Speichern hat nicht geklappt." };
  revalidatePath(`/coach/teilnehmer/${participantId}`);
  return { ok: "Gespeichert" };
}

// ---------------------------------------------------------------------
// Bibliothek
// ---------------------------------------------------------------------
function parseDrills(raw: string): TemplateDrill[] {
  // Eine Zeile pro Drill: Titel | Beschreibung | Rhythmus | Dauer
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 10)
    .map((l) => {
      const [title = "", description = "", cadence = "", duration = ""] = l.split("|").map((x) => x.trim());
      return { title: title.slice(0, 120), description: description.slice(0, 300), cadence: cadence.slice(0, 60), duration: duration.slice(0, 30) };
    })
    .filter((d) => d.title);
}

export async function saveTemplate(templateId: string | null, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireCoach();
  const name = s(fd, "name", 120);
  if (!name) return { error: "Der Engpass braucht einen Namen." };
  const values = {
    name,
    category: s(fd, "category", 60),
    signs: parseLines(s(fd, "signs")),
    trigger_text: s(fd, "trigger_text", 300),
    metric_label: s(fd, "metric_label", 120),
    reflection_question: s(fd, "reflection_question", 200),
    target_score: parseTarget(s(fd, "target_score")),
    drills: parseDrills(s(fd, "drills", 8000)),
    criteria: parseLines(s(fd, "criteria")),
  };
  if (templateId) {
    const { error } = await supabase.from("bottleneck_templates").update(values).eq("id", templateId);
    if (error) return { error: "Speichern hat nicht geklappt." };
    revalidatePath("/coach/bibliothek", "layout");
    return { ok: "Gespeichert" };
  }
  const { count } = await supabase.from("bottleneck_templates").select("id", { count: "exact", head: true });
  const { data, error } = await supabase.from("bottleneck_templates").insert({ ...values, sort_order: (count ?? 0) + 1 }).select("id").single();
  if (error || !data) return { error: "Anlegen hat nicht geklappt." };
  revalidatePath("/coach/bibliothek", "layout");
  redirect(`/coach/bibliothek/${data.id}`);
}

export async function deleteTemplate(templateId: string) {
  const { supabase } = await requireCoach();
  await supabase.from("bottleneck_templates").delete().eq("id", templateId);
  revalidatePath("/coach/bibliothek", "layout");
  redirect("/coach/bibliothek");
}

// ---------------------------------------------------------------------
// Einladungscode
// ---------------------------------------------------------------------
export async function updateInviteCode(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireCoach();
  const code = s(fd, "invite_code", 60).replace(/\s+/g, "");
  if (code.length < 6) return { error: "Der Code braucht mindestens 6 Zeichen." };
  const { error } = await supabase.from("app_settings").update({ invite_code: code }).eq("id", true);
  if (error) return { error: "Speichern hat nicht geklappt." };
  revalidatePath("/einstellungen");
  return { ok: "Neuer Code gespeichert" };
}
