"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { DAILY_COUNT_FIELDS, type ObjectionItem, type CallResult, type BottleneckTemplate, type SalesRole } from "@/lib/types";
import { OBJECTION_LABELS } from "@/lib/metrics";
import { todayISO } from "@/lib/dates";

export type FormState = { error?: string; ok?: string } | undefined;

function int(v: FormDataEntryValue | null, max = 100000): number {
  const n = Math.round(Number(String(v ?? "").replace(/[^\d.-]/g, "")));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

function money(v: FormDataEntryValue | null): number {
  const n = Number(String(v ?? "").replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 100_000_000) : 0;
}

function validDay(v: FormDataEntryValue | null): string {
  const s = String(v ?? "");
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : todayISO();
}

// ---------------------------------------------------------------------
// Drill abhaken
// ---------------------------------------------------------------------
export async function toggleDrill(drillId: string, day: string, done: boolean) {
  const { supabase, user } = await requireUser();
  if (done) {
    await supabase.from("drill_logs").upsert({ drill_id: drillId, participant_id: user.id, day }, { onConflict: "drill_id,day", ignoreDuplicates: true });
  } else {
    await supabase.from("drill_logs").delete().eq("drill_id", drillId).eq("day", day).eq("participant_id", user.id);
  }
  revalidatePath("/");
  revalidatePath("/engpass");
}

// ---------------------------------------------------------------------
// Tages-Check-in
// ---------------------------------------------------------------------
export async function saveDaily(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user, profile } = await requireUser();
  const day = validDay(fd.get("day"));
  const row: Record<string, number | string> = {
    participant_id: user.id,
    day,
    order_volume: money(fd.get("order_volume")),
    cash_collected: money(fd.get("cash_collected")),
    commission_pct: Number(profile.commission_pct),
    updated_at: new Date().toISOString(),
  };
  for (const f of DAILY_COUNT_FIELDS) row[f] = int(fd.get(f), 10000);
  const { error } = await supabase.from("daily_entries").upsert(row, { onConflict: "participant_id,day" });
  if (error) return { error: "Speichern hat nicht geklappt. Bitte versuch es noch einmal." };
  revalidatePath("/");
  revalidatePath("/checkin");
  return { ok: "Gespeichert" };
}

// ---------------------------------------------------------------------
// Call-Reflexion
// ---------------------------------------------------------------------
const RESULTS: CallResult[] = ["close", "followup", "no_close", "deposit"];

export async function saveReflection(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const result = String(fd.get("result") ?? "");
  const scoreRaw = Number(fd.get("score"));
  let objections: ObjectionItem[] = [];
  try {
    const parsed = JSON.parse(String(fd.get("objections") ?? "[]"));
    if (Array.isArray(parsed)) {
      objections = parsed
        .filter((o) => o && typeof o.type === "string" && o.type in OBJECTION_LABELS)
        .map((o) => ({ type: o.type, solved: !!o.solved }));
    }
  } catch {
    objections = [];
  }
  const bottleneckId = String(fd.get("bottleneck_id") ?? "") || null;
  const { error } = await supabase.from("call_reflections").insert({
    participant_id: user.id,
    bottleneck_id: bottleneckId,
    day: validDay(fd.get("day")),
    label: String(fd.get("label") ?? "").slice(0, 120),
    result: RESULTS.includes(result as CallResult) ? result : null,
    score: scoreRaw >= 1 && scoreRaw <= 10 ? Math.round(scoreRaw) : null,
    objections,
    what_worked: String(fd.get("what_worked") ?? "").slice(0, 2000),
    next_time: String(fd.get("next_time") ?? "").slice(0, 2000),
  });
  if (error) return { error: "Speichern hat nicht geklappt. Bitte versuch es noch einmal." };
  revalidatePath("/");
  revalidatePath("/engpass");
  return { ok: "Reflexion gespeichert" };
}

// ---------------------------------------------------------------------
// Kommentar zum Engpass (Teilnehmer und Coach)
// ---------------------------------------------------------------------
export async function addComment(bottleneckId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const body = String(fd.get("body") ?? "").trim();
  if (!body) return { error: "Schreib zuerst eine Nachricht." };
  const { error } = await supabase.from("comments").insert({ bottleneck_id: bottleneckId, author_id: user.id, body: body.slice(0, 4000) });
  if (error) return { error: "Senden hat nicht geklappt." };
  revalidatePath("/engpass");
  revalidatePath("/coach/teilnehmer/[id]", "page");
  return { ok: "sent" };
}

// ---------------------------------------------------------------------
// Engpass vorschlagen (Teilnehmer)
// ---------------------------------------------------------------------
async function createProposalFromTemplate(templateId: string | null, title: string, why: string) {
  const { supabase, user } = await requireUser();
  let tpl: BottleneckTemplate | null = null;
  if (templateId) {
    const { data } = await supabase.from("bottleneck_templates").select("*").eq("id", templateId).single<BottleneckTemplate>();
    tpl = data ?? null;
  }
  const { data: b, error } = await supabase
    .from("bottlenecks")
    .insert({
      participant_id: user.id,
      template_id: tpl?.id ?? null,
      title: (title || tpl?.name || "Neuer Engpass").slice(0, 120),
      why: why.slice(0, 4000),
      metric_label: tpl?.metric_label ?? "",
      reflection_question: tpl?.reflection_question ?? "",
      target_score: tpl?.target_score ?? null,
      criteria: (tpl?.criteria ?? []).map((label) => ({ label, done: false })),
      status: "proposed",
      proposed_by: user.id,
    })
    .select("id")
    .single();
  if (error || !b) return { error: "Vorschlag konnte nicht gespeichert werden." };
  if (tpl?.drills?.length) {
    await supabase.from("drills").insert(
      tpl.drills.map((d, i) => ({ bottleneck_id: b.id, title: d.title, description: d.description, cadence: d.cadence, duration: d.duration, sort_order: i }))
    );
  }
  return { ok: "ok" };
}

export async function proposeBottleneck(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const { count } = await supabase.from("bottlenecks").select("id", { count: "exact", head: true }).eq("participant_id", user.id).eq("status", "proposed");
  if ((count ?? 0) > 0) return { error: "Du hast schon einen offenen Vorschlag. Dein Coach schaut ihn sich an." };
  const res = await createProposalFromTemplate(String(fd.get("template_id") ?? "") || null, String(fd.get("title") ?? "").trim(), String(fd.get("why") ?? "").trim());
  if (res.error) return res;
  revalidatePath("/");
  revalidatePath("/engpass");
  return { ok: "Vorschlag gesendet. Ihr legt ihn im nächsten Call gemeinsam fest." };
}

// ---------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------
const SALES_ROLES: SalesRole[] = ["setter", "closer", "both"];

export async function completeOnboarding(fd: FormData) {
  const { supabase, user } = await requireUser();
  const salesRole = String(fd.get("sales_role"));
  let selfCheck: Record<string, number> = {};
  try {
    const parsed = JSON.parse(String(fd.get("self_check") ?? "{}"));
    for (const [k, v] of Object.entries(parsed)) {
      const n = Number(v);
      if (n >= 1 && n <= 5) selfCheck[k.slice(0, 40)] = n;
    }
  } catch {
    selfCheck = {};
  }
  await supabase
    .from("profiles")
    .update({
      sales_role: SALES_ROLES.includes(salesRole as SalesRole) ? salesRole : "both",
      commission_goal: int(fd.get("commission_goal"), 10_000_000),
      commission_pct: Math.min(100, Math.max(0, Number(String(fd.get("commission_pct") ?? "10").replace(",", ".")) || 0)),
      avg_cash_per_sale: int(fd.get("avg_cash_per_sale"), 10_000_000),
      assumed_showup_pct: Math.min(100, int(fd.get("assumed_showup_pct"))),
      assumed_close_pct: Math.min(100, int(fd.get("assumed_close_pct"))),
      self_check: selfCheck,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  const slug = String(fd.get("suggestion_slug") ?? "");
  const { count } = await supabase.from("bottlenecks").select("id", { count: "exact", head: true }).eq("participant_id", user.id);
  if ((count ?? 0) === 0 && slug) {
    const { data: tpl } = await supabase.from("bottleneck_templates").select("id").eq("slug", slug).maybeSingle();
    await createProposalFromTemplate(tpl?.id ?? null, "", String(fd.get("suggestion_why") ?? ""));
  }
  redirect("/");
}

// ---------------------------------------------------------------------
// Ziele & Profil
// ---------------------------------------------------------------------
export async function saveProfile(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const upd: Record<string, string | number> = {};
  const name = String(fd.get("full_name") ?? "").trim();
  if (name) upd.full_name = name.slice(0, 80);
  if (fd.has("sales_role")) {
    const salesRole = String(fd.get("sales_role"));
    upd.sales_role = SALES_ROLES.includes(salesRole as SalesRole) ? salesRole : "both";
  }
  if (fd.has("commission_goal")) upd.commission_goal = int(fd.get("commission_goal"), 10_000_000);
  if (fd.has("commission_pct")) upd.commission_pct = Math.min(100, Math.max(0, Number(String(fd.get("commission_pct")).replace(",", ".")) || 0));
  if (fd.has("avg_cash_per_sale")) upd.avg_cash_per_sale = int(fd.get("avg_cash_per_sale"), 10_000_000);
  if (fd.has("assumed_showup_pct")) upd.assumed_showup_pct = Math.min(100, int(fd.get("assumed_showup_pct")));
  if (fd.has("assumed_close_pct")) upd.assumed_close_pct = Math.min(100, int(fd.get("assumed_close_pct")));
  if (fd.has("weekly_slots")) upd.weekly_slots = Math.max(1, int(fd.get("weekly_slots"), 1000));
  const { error } = await supabase.from("profiles").update(upd).eq("id", user.id);
  if (error) return { error: "Speichern hat nicht geklappt." };
  revalidatePath("/", "layout");
  return { ok: "Gespeichert" };
}

// ---------------------------------------------------------------------
// Tagesplan im Trainingskalender (Teilnehmer für sich, Coach für alle)
// ---------------------------------------------------------------------
async function planGuard(participantId: string) {
  const s = await requireUser();
  if (s.profile.role !== "coach" && participantId !== s.user.id) return null;
  return s;
}

function revalidatePlan(participantId: string) {
  revalidatePath("/engpass");
  revalidatePath(`/coach/teilnehmer/${participantId}`);
}

export async function savePlanDay(participantId: string, _: FormState, fd: FormData): Promise<FormState> {
  const s = await planGuard(participantId);
  if (!s) return { error: "Keine Berechtigung." };
  const day = String(fd.get("day") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: "Ungültiger Tag." };
  const focus = String(fd.get("focus") ?? "").trim().slice(0, 120);
  const method = String(fd.get("method") ?? "").trim().slice(0, 1000);

  if (fd.get("clear") === "1" || (!focus && !method)) {
    await s.supabase.from("plan_days").delete().eq("participant_id", participantId).eq("day", day);
    revalidatePlan(participantId);
    return { ok: "Gelöscht" };
  }

  const now = new Date().toISOString();
  const rows: Record<string, string | boolean>[] = [
    { participant_id: participantId, day, focus, method, done: fd.get("done") === "1", updated_by: s.user.id, updated_at: now },
  ];
  if (fd.get("apply_week") === "1") {
    const [y, m, d] = day.split("-").map(Number);
    const base = new Date(Date.UTC(y, m - 1, d));
    const dow = (base.getUTCDay() + 6) % 7;
    for (let i = 0; i < 5; i++) {
      const x = new Date(base);
      x.setUTCDate(base.getUTCDate() - dow + i);
      const iso = x.toISOString().slice(0, 10);
      if (iso !== day) rows.push({ participant_id: participantId, day: iso, focus, method, updated_by: s.user.id, updated_at: now });
    }
  }
  // Erst der gewählte Tag (mit Erledigt-Status), dann die übrigen Tage ohne den Status anzufassen
  const { error } = await s.supabase.from("plan_days").upsert(rows[0], { onConflict: "participant_id,day" });
  if (!error && rows.length > 1) await s.supabase.from("plan_days").upsert(rows.slice(1), { onConflict: "participant_id,day" });
  if (error) return { error: "Speichern hat nicht geklappt. Ist das Datenbank-Update 002 schon eingespielt?" };
  revalidatePlan(participantId);
  return { ok: "Gespeichert" };
}

export async function togglePlanDone(participantId: string, day: string, done: boolean) {
  const s = await planGuard(participantId);
  if (!s) return;
  await s.supabase.from("plan_days").update({ done, updated_by: s.user.id, updated_at: new Date().toISOString() }).eq("participant_id", participantId).eq("day", day);
  revalidatePlan(participantId);
}
