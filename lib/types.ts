export type UserRole = "participant" | "coach";
export type SalesRole = "setter" | "closer" | "both";
export type BottleneckStatus = "proposed" | "active" | "solved" | "archived";
export type CallResult = "close" | "followup" | "no_close" | "deposit";

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  sales_role: SalesRole;
  commission_goal: number;
  commission_pct: number;
  avg_cash_per_sale: number;
  assumed_showup_pct: number;
  assumed_close_pct: number;
  weekly_slots: number;
  self_check: Record<string, number>;
  onboarded_at: string | null;
  created_at: string;
}

export interface TemplateDrill {
  title: string;
  description: string;
  cadence: string;
  duration: string;
}

export interface BottleneckTemplate {
  id: string;
  slug: string | null;
  name: string;
  category: string;
  signs: string[];
  trigger_text: string;
  metric_label: string;
  reflection_question: string;
  target_score: number | null;
  drills: TemplateDrill[];
  criteria: string[];
  sort_order: number;
}

export interface Criterion {
  label: string;
  done: boolean;
}

export interface Evidence {
  text: string;
  source: string;
}

export interface Bottleneck {
  id: string;
  participant_id: string;
  template_id: string | null;
  seq: number;
  title: string;
  why: string;
  evidence: Evidence[];
  metric_label: string;
  reflection_question: string;
  target_score: number | null;
  criteria: Criterion[];
  status: BottleneckStatus;
  proposed_by: string | null;
  proposed_at: string;
  activated_by: string | null;
  activated_at: string | null;
  solved_at: string | null;
  created_at: string;
}

export interface Drill {
  id: string;
  bottleneck_id: string;
  title: string;
  description: string;
  cadence: string;
  duration: string;
  sort_order: number;
}

export interface DrillLog {
  drill_id: string;
  participant_id: string;
  day: string;
}

export const DAILY_COUNT_FIELDS = [
  "dials",
  "pickups",
  "conversations",
  "booked_outbound",
  "calendar_calls",
  "no_shows",
  "reschedules",
  "cancellations",
  "deposits",
  "one_call_closes",
  "followup_sales",
  "upsell_conversations",
  "upsells",
] as const;

export type DailyCountField = (typeof DAILY_COUNT_FIELDS)[number];

export type DailyEntry = {
  participant_id: string;
  day: string;
  order_volume: number;
  cash_collected: number;
  commission_pct: number;
  updated_at?: string;
} & Record<DailyCountField, number>;

export interface ObjectionItem {
  type: ObjectionType;
  solved: boolean;
}

export type ObjectionType =
  | "logistisch_geld"
  | "logistisch_partner"
  | "angst_geld"
  | "angst_partner"
  | "denke_drueber_nach"
  | "zeit"
  | "wert";

export interface CallReflection {
  id: string;
  participant_id: string;
  bottleneck_id: string | null;
  day: string;
  label: string;
  result: CallResult | null;
  score: number | null;
  objections: ObjectionItem[];
  what_worked: string;
  next_time: string;
  created_at: string;
}

export interface Comment {
  id: string;
  bottleneck_id: string;
  author_id: string;
  body: string;
  created_at: string;
}
