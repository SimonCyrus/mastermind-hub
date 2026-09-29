-- =====================================================================
-- Simon Cyrus MASTERMIND HUB · Datenbank-Setup
-- Einmal komplett im Supabase SQL-Editor ausführen.
-- Vorher unten im Abschnitt "EINSTELLUNGEN" Coach-E-Mail und
-- Einladungscode prüfen.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Typen
-- ---------------------------------------------------------------------
create type public.user_role as enum ('participant', 'coach');
create type public.sales_role as enum ('setter', 'closer', 'both');
create type public.bottleneck_status as enum ('proposed', 'active', 'solved', 'archived');
create type public.call_result as enum ('close', 'followup', 'no_close', 'deposit');

-- ---------------------------------------------------------------------
-- Einstellungen (eine Zeile): Einladungscode + Coach-E-Mail
-- ---------------------------------------------------------------------
create table public.app_settings (
  id boolean primary key default true check (id),
  invite_code text not null,
  coach_email text not null
);

-- ---------------------------------------------------------------------
-- Profile
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role public.user_role not null default 'participant',
  sales_role public.sales_role not null default 'both',
  commission_goal integer not null default 10000 check (commission_goal >= 0),
  commission_pct numeric(5, 2) not null default 10 check (commission_pct >= 0 and commission_pct <= 100),
  avg_cash_per_sale integer not null default 2800 check (avg_cash_per_sale >= 0),
  assumed_showup_pct numeric(5, 2) not null default 80 check (assumed_showup_pct >= 0 and assumed_showup_pct <= 100),
  assumed_close_pct numeric(5, 2) not null default 30 check (assumed_close_pct >= 0 and assumed_close_pct <= 100),
  weekly_slots integer not null default 40 check (weekly_slots > 0),
  self_check jsonb not null default '{}'::jsonb,
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Engpass-Vorlagen (Bibliothek des Coaches)
-- ---------------------------------------------------------------------
create table public.bottleneck_templates (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  category text not null default '',
  signs text[] not null default '{}',
  trigger_text text not null default '',
  metric_label text not null default '',
  reflection_question text not null default '',
  target_score numeric(4, 1),
  drills jsonb not null default '[]'::jsonb,
  criteria text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Engpässe pro Teilnehmer
-- ---------------------------------------------------------------------
create table public.bottlenecks (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.profiles (id) on delete cascade,
  template_id uuid references public.bottleneck_templates (id) on delete set null,
  seq integer not null default 0,
  title text not null,
  why text not null default '',
  evidence jsonb not null default '[]'::jsonb,
  metric_label text not null default '',
  reflection_question text not null default '',
  target_score numeric(4, 1),
  criteria jsonb not null default '[]'::jsonb,
  status public.bottleneck_status not null default 'proposed',
  proposed_by uuid references public.profiles (id) on delete set null,
  proposed_at timestamptz not null default now(),
  activated_by uuid references public.profiles (id) on delete set null,
  activated_at timestamptz,
  solved_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index bottlenecks_one_active on public.bottlenecks (participant_id) where status = 'active';
create index bottlenecks_participant on public.bottlenecks (participant_id, seq);

create table public.drills (
  id uuid primary key default gen_random_uuid(),
  bottleneck_id uuid not null references public.bottlenecks (id) on delete cascade,
  title text not null,
  description text not null default '',
  cadence text not null default '',
  duration text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index drills_bottleneck on public.drills (bottleneck_id, sort_order);

create table public.drill_logs (
  drill_id uuid not null references public.drills (id) on delete cascade,
  participant_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (drill_id, day)
);

-- ---------------------------------------------------------------------
-- Tageszahlen (entspricht dem bisherigen Tracking-Sheet)
-- ---------------------------------------------------------------------
create table public.daily_entries (
  participant_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  dials integer not null default 0 check (dials >= 0),
  pickups integer not null default 0 check (pickups >= 0),
  conversations integer not null default 0 check (conversations >= 0),
  booked_outbound integer not null default 0 check (booked_outbound >= 0),
  calendar_calls integer not null default 0 check (calendar_calls >= 0),
  no_shows integer not null default 0 check (no_shows >= 0),
  reschedules integer not null default 0 check (reschedules >= 0),
  cancellations integer not null default 0 check (cancellations >= 0),
  deposits integer not null default 0 check (deposits >= 0),
  one_call_closes integer not null default 0 check (one_call_closes >= 0),
  followup_sales integer not null default 0 check (followup_sales >= 0),
  upsell_conversations integer not null default 0 check (upsell_conversations >= 0),
  upsells integer not null default 0 check (upsells >= 0),
  order_volume numeric(12, 2) not null default 0 check (order_volume >= 0),
  cash_collected numeric(12, 2) not null default 0 check (cash_collected >= 0),
  commission_pct numeric(5, 2) not null default 10,
  updated_at timestamptz not null default now(),
  primary key (participant_id, day)
);

-- ---------------------------------------------------------------------
-- Call-Reflexionen
-- ---------------------------------------------------------------------
create table public.call_reflections (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.profiles (id) on delete cascade,
  bottleneck_id uuid references public.bottlenecks (id) on delete set null,
  day date not null default current_date,
  label text not null default '',
  result public.call_result,
  score smallint check (score between 1 and 10),
  objections jsonb not null default '[]'::jsonb,
  what_worked text not null default '',
  next_time text not null default '',
  created_at timestamptz not null default now()
);
create index call_reflections_participant on public.call_reflections (participant_id, day);

-- ---------------------------------------------------------------------
-- Austausch zum Engpass + private Coach-Notizen
-- ---------------------------------------------------------------------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  bottleneck_id uuid not null references public.bottlenecks (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index comments_bottleneck on public.comments (bottleneck_id, created_at);

create table public.coach_notes (
  participant_id uuid primary key references public.profiles (id) on delete cascade,
  body text not null default '',
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- Funktionen & Trigger
-- =====================================================================
create or replace function public.is_coach()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'coach');
$$;

-- Neues Konto: Einladungscode prüfen, Profil anlegen, Coach erkennen
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  s public.app_settings;
  is_coach_account boolean;
begin
  select * into s from public.app_settings where id;
  is_coach_account := s.coach_email is not null and lower(new.email) = lower(s.coach_email);
  if not is_coach_account then
    if s.invite_code is null
       or coalesce(new.raw_user_meta_data ->> 'invite_code', '') <> s.invite_code then
      raise exception 'Ungültiger Einladungscode';
    end if;
  end if;
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when is_coach_account then 'coach'::public.user_role else 'participant'::public.user_role end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Nur der Coach darf Rollen ändern
create or replace function public.protect_profile_role()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- auth.uid() ist leer im SQL-Editor / mit Service-Key: dort ist alles erlaubt
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_coach() then
    raise exception 'Rolle kann nur vom Coach geändert werden';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- Laufende Nummer pro Teilnehmer (Engpass 01, 02, ...)
create or replace function public.set_bottleneck_seq()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.seq is null or new.seq = 0 then
    select coalesce(max(seq), 0) + 1 into new.seq
    from public.bottlenecks where participant_id = new.participant_id;
  end if;
  return new;
end;
$$;

create trigger bottlenecks_seq
  before insert on public.bottlenecks
  for each row execute function public.set_bottleneck_seq();

-- Teilnehmer dürfen nur Vorschläge anlegen und nur Titel/Begründung ihres
-- eigenen Vorschlags ändern. Status, Kriterien etc. setzt der Coach.
create or replace function public.guard_bottleneck_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or public.is_coach() then
    return new;
  end if;
  if new.status <> 'proposed' or old.status <> 'proposed'
     or new.participant_id <> old.participant_id
     or new.criteria is distinct from old.criteria
     or new.activated_at is distinct from old.activated_at
     or new.solved_at is distinct from old.solved_at then
    raise exception 'Nur der Coach kann das ändern';
  end if;
  return new;
end;
$$;

create trigger bottlenecks_guard
  before update on public.bottlenecks
  for each row execute function public.guard_bottleneck_update();

-- Hilfsfunktion: darf der aktuelle Nutzer diesen Engpass sehen?
create or replace function public.can_see_bottleneck(b_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_coach() or exists (
    select 1 from public.bottlenecks b where b.id = b_id and b.participant_id = auth.uid()
  );
$$;

create or replace function public.owns_proposed_bottleneck(b_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.bottlenecks b
    where b.id = b_id and b.participant_id = auth.uid() and b.status = 'proposed'
  );
$$;

create or replace function public.owns_drill(d_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.drills d join public.bottlenecks b on b.id = d.bottleneck_id
    where d.id = d_id and b.participant_id = auth.uid()
  );
$$;

-- =====================================================================
-- Zugriffsrechte (Row Level Security)
-- Teilnehmer sehen nur ihre eigenen Daten, der Coach sieht alles.
-- =====================================================================
alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.bottleneck_templates enable row level security;
alter table public.bottlenecks enable row level security;
alter table public.drills enable row level security;
alter table public.drill_logs enable row level security;
alter table public.daily_entries enable row level security;
alter table public.call_reflections enable row level security;
alter table public.comments enable row level security;
alter table public.coach_notes enable row level security;

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

create policy settings_coach_read on public.app_settings for select to authenticated using (public.is_coach());
create policy settings_coach_write on public.app_settings for update to authenticated using (public.is_coach()) with check (public.is_coach());

-- Teilnehmer sehen sich selbst und das Profil des Coaches (für Namen im Austausch)
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_coach() or role = 'coach');
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_coach()) with check (id = auth.uid() or public.is_coach());

create policy templates_read on public.bottleneck_templates for select to authenticated using (true);
create policy templates_write on public.bottleneck_templates for all to authenticated
  using (public.is_coach()) with check (public.is_coach());

create policy bottlenecks_read on public.bottlenecks for select to authenticated
  using (participant_id = auth.uid() or public.is_coach());
create policy bottlenecks_insert on public.bottlenecks for insert to authenticated
  with check (public.is_coach() or (participant_id = auth.uid() and status = 'proposed'));
create policy bottlenecks_update on public.bottlenecks for update to authenticated
  using (public.is_coach() or (participant_id = auth.uid() and status = 'proposed'))
  with check (public.is_coach() or (participant_id = auth.uid() and status = 'proposed'));
create policy bottlenecks_delete on public.bottlenecks for delete to authenticated
  using (public.is_coach() or (participant_id = auth.uid() and status = 'proposed'));

create policy drills_read on public.drills for select to authenticated
  using (public.can_see_bottleneck(bottleneck_id));
create policy drills_write on public.drills for all to authenticated
  using (public.is_coach() or public.owns_proposed_bottleneck(bottleneck_id))
  with check (public.is_coach() or public.owns_proposed_bottleneck(bottleneck_id));

create policy drill_logs_read on public.drill_logs for select to authenticated
  using (participant_id = auth.uid() or public.is_coach());
create policy drill_logs_insert on public.drill_logs for insert to authenticated
  with check (participant_id = auth.uid() and public.owns_drill(drill_id));
create policy drill_logs_delete on public.drill_logs for delete to authenticated
  using (participant_id = auth.uid());

create policy daily_read on public.daily_entries for select to authenticated
  using (participant_id = auth.uid() or public.is_coach());
create policy daily_insert on public.daily_entries for insert to authenticated
  with check (participant_id = auth.uid());
create policy daily_update on public.daily_entries for update to authenticated
  using (participant_id = auth.uid()) with check (participant_id = auth.uid());
create policy daily_delete on public.daily_entries for delete to authenticated
  using (participant_id = auth.uid());

create policy reflections_read on public.call_reflections for select to authenticated
  using (participant_id = auth.uid() or public.is_coach());
create policy reflections_insert on public.call_reflections for insert to authenticated
  with check (participant_id = auth.uid()
    and (bottleneck_id is null or public.can_see_bottleneck(bottleneck_id)));
create policy reflections_update on public.call_reflections for update to authenticated
  using (participant_id = auth.uid()) with check (participant_id = auth.uid());
create policy reflections_delete on public.call_reflections for delete to authenticated
  using (participant_id = auth.uid());

create policy comments_read on public.comments for select to authenticated
  using (public.can_see_bottleneck(bottleneck_id));
create policy comments_insert on public.comments for insert to authenticated
  with check (author_id = auth.uid() and public.can_see_bottleneck(bottleneck_id));
create policy comments_delete on public.comments for delete to authenticated
  using (author_id = auth.uid());

create policy notes_coach on public.coach_notes for all to authenticated
  using (public.is_coach()) with check (public.is_coach());

-- =====================================================================
-- EINSTELLUNGEN – hier anpassen
-- coach_email: mit dieser E-Mail registrierst du dich als Coach.
-- invite_code: diesen Code geben deine Teilnehmer bei der Registrierung ein.
-- (Den Code kannst du später in der App ändern.)
-- =====================================================================
insert into public.app_settings (invite_code, coach_email)
values ('MASTERMIND2026', 'simoncyrus.web@gmail.com');

-- =====================================================================
-- Engpass-Bibliothek: 9 Startvorlagen (in der App bearbeitbar)
-- =====================================================================
insert into public.bottleneck_templates
  (slug, sort_order, name, category, signs, trigger_text, metric_label, reflection_question, target_score, drills, criteria)
values
('skript', 1, 'Skript verinnerlichen', 'Grundlagen',
 array['Liest sichtbar ab oder verliert den Faden', 'Ganze Phasen fehlen oder kommen in falscher Reihenfolge', 'Unsicher, sobald der Lead vom Ablauf abweicht'],
 'Neuer Teilnehmer oder Gesamt-Closing-Rate unter 15 % über 2 Wochen',
 'Sicherheit im Ablauf (1–10)', 'Wie sicher warst du im Ablauf?', 8,
 '[{"title":"Skript laut durchsprechen","description":"Komplett, ohne Pause, mit Aufnahme","cadence":"Täglich","duration":"20 Min"},{"title":"Phasen-Karteikarten","description":"Phase ziehen, frei formulieren","cadence":"Täglich","duration":"10 Min"},{"title":"Rollenspiel mit Buddy","description":"Buddy weicht bewusst vom Ablauf ab","cadence":"2× pro Woche","duration":"30 Min"}]',
 array['Skript-Abfrage 10 / 10', '5 Calls ohne Blick ins Skript', 'Coach-Freigabe']),
('tonalitaet', 2, 'Tonalität', 'Wirkung',
 array['Monoton oder zu schnell', 'Aussagen klingen wie Fragen, wirkt unsicher', 'Kein Tempowechsel vor wichtigen Punkten'],
 'Pickup → Gespräch 30 Sek.+ unter 50 % oder Call-Review unter 6 / 10',
 'Ruhe und Klarheit der Stimme (1–10)', 'Wie ruhig und klar war deine Stimme?', 8,
 '[{"title":"Drei Kernsätze, drei Tonlagen","description":"Voice-Memo aufnehmen und anhören","cadence":"Täglich","duration":"10 Min"},{"title":"Pausen-Drill","description":"2 Sek. Pause vor Preis und Closing-Frage","cadence":"Vor jedem Call","duration":"2 Min"},{"title":"Aufnahme-Analyse","description":"Eine Stelle finden, die unsicher klingt","cadence":"Täglich","duration":"10 Min"}]',
 array['Score ≥ 8 in 3 Call-Reviews', 'Pickup → Gespräch ≥ 55 %', 'Coach-Freigabe']),
('menschlich', 3, 'Menschlich rüberkommen', 'Opening & Rapport',
 array['Opening wirkt abgelesen', 'Rapport-Phase unter 2 Minuten', 'Lead antwortet knapp und öffnet sich nicht'],
 '„Denke drüber nach“ in über 15 % der Calls und Rapport-Phase meist unter 2 Min',
 'Rapport-Score (1–10)', 'Wie menschlich bist du in diesem Call rübergekommen?', 8,
 '[{"title":"Mimik im Zoom","description":"Kamera an, aufnehmen, Lächeln und Nicken bewusst einsetzen","cadence":"Täglich","duration":"15 Min"},{"title":"3 persönliche Fragen vorbereiten","description":"Aus dem Lead-Formular: Beruf, Ort, ein Detail","cadence":"Vor jedem Call","duration":"3 Min"},{"title":"Rapport-Phase markieren","description":"In der Aufnahme: Wo kippt es ins Skript?","cadence":"Täglich","duration":"10 Min"}]',
 array['10 Calls reflektiert', 'Ø Rapport-Score ≥ 8,0', 'Coach-Freigabe nach Call-Review']),
('pain', 4, 'Tiefer in den Pain', 'Bedarfsanalyse',
 array['Pain-Phase in unter 5 Minuten abgehakt', 'Lead bleibt rational, keine Emotion', 'Viele „Denke drüber nach“ am Ende'],
 'Ø Pain-Tiefe unter 6 über 10 Calls oder „Denke drüber nach“ in über 15 % der Calls',
 'Pain-Tiefe (1–10)', 'Wie tief bist du in den Pain gekommen?', 8,
 '[{"title":"3-Nachfragen-Regel","description":"„Was bedeutet das für dich?“ dreimal nachhaken","cadence":"Jeder Call","duration":"–"},{"title":"Pain-Fragen-Bank","description":"5 neue Nachfragen formulieren und laut üben","cadence":"Täglich","duration":"10 Min"},{"title":"Pain-Phase in Aufnahme zählen","description":"Wie oft nachgehakt? Wo abgebrochen?","cadence":"3× pro Woche","duration":"15 Min"}]',
 array['Ø Pain-Tiefe ≥ 8 über 10 Calls', '„Denke drüber nach“ unter 10 %', 'Coach-Freigabe']),
('frame', 5, 'Frame-Kontrolle', 'Gesprächsführung',
 array['Lead führt das Gespräch', 'Preisfrage kommt vor der Präsentation', 'Gespräch zerfasert, kein roter Faden'],
 'Preisfrage vor der Präsentation in über 30 % der Calls',
 'Gesprächsführung (1 = Lead, 10 = du)', 'Wie klar hast du das Gespräch geführt?', 8,
 '[{"title":"Agenda in den ersten 60 Sek.","description":"Ablauf ansagen und Zustimmung holen","cadence":"Jeder Call","duration":"1 Min"},{"title":"Umlenk-Sätze","description":"5 Sätze, um zurück in die Phase zu führen","cadence":"Täglich","duration":"10 Min"},{"title":"Rollenspiel: schwieriger Lead","description":"Buddy versucht, das Gespräch zu übernehmen","cadence":"2× pro Woche","duration":"20 Min"}]',
 array['Ø Score ≥ 8 über 10 Calls', 'Preisfrage vorab unter 10 %', 'Coach-Freigabe']),
('einwand-geld', 6, 'Einwand „Geld“ lösen', 'Einwände',
 array['Geld-Einwand wird akzeptiert statt geprüft', 'Kein Isolieren: „Ist Geld das Einzige?“', 'Finanzierung wird nicht angeboten'],
 'Geld-Einwände gelöst unter 50 % bei mindestens 5 Fällen',
 'Sicherheit beim Geld-Einwand (1–10)', 'Wie souverän warst du beim Thema Geld?', 8,
 '[{"title":"Isolieren-Frage","description":"Laut üben, bis sie natürlich klingt","cadence":"Täglich","duration":"5 Min"},{"title":"Logistisch vs. Angst unterscheiden","description":"5 Aufnahmen einordnen","cadence":"2× pro Woche","duration":"20 Min"},{"title":"Rollenspiel: 3 Varianten","description":"Kein Geld, zu teuer, muss sparen","cadence":"2× pro Woche","duration":"20 Min"}]',
 array['≥ 60 % gelöst über 10 Fälle', 'Isolieren in jedem Fall', 'Coach-Freigabe']),
('einwand-partner', 7, 'Partner-Einwand lösen', 'Einwände',
 array['„Muss mit meinem Partner sprechen“ beendet den Call', 'Partner wird nicht vorab im Setting geklärt', 'Kein Commitment, wie der Lead selbst entscheidet'],
 'Partner-Einwände gelöst unter 40 % bei mindestens 5 Fällen',
 'Sicherheit beim Partner-Einwand (1–10)', 'Wie souverän warst du beim Partner-Thema?', 8,
 '[{"title":"Partner-Frage im Opening","description":"„Entscheidest du das alleine?“","cadence":"Jeder Call","duration":"1 Min"},{"title":"Angst hinter dem Partner finden","description":"„Was glaubst du, würde er sagen?“","cadence":"Täglich","duration":"10 Min"},{"title":"Rollenspiel Partner-Einwand","description":"Buddy spielt beide Varianten","cadence":"2× pro Woche","duration":"20 Min"}]',
 array['≥ 60 % gelöst über 8 Fälle', 'Partner-Frage in jedem Opening', 'Coach-Freigabe']),
('closing-frage', 8, 'Closing-Frage klar stellen', 'Closing',
 array['Redet nach dem Preis weiter', 'Wartet, dass der Lead von sich aus Ja sagt', 'Viele Follow-ups, wenige One-Call-Closes'],
 'Follow-up-Sales höher als One-Call-Closes über 2 Wochen',
 'Klarheit der Closing-Frage (1–10)', 'Hast du die Closing-Frage klar gestellt und danach geschwiegen?', 8,
 '[{"title":"Closing-Frage laut","description":"20× am Stück, gleiche Tonlage","cadence":"Täglich","duration":"5 Min"},{"title":"5 Sekunden Stille","description":"Nach der Frage schweigen","cadence":"Jeder Call","duration":"–"},{"title":"Aufnahme: nach dem Preis","description":"Was sagst du in den 30 Sek. danach?","cadence":"3× pro Woche","duration":"10 Min"}]',
 array['In 10 / 10 Calls gestellt', 'One-Call-Close-Rate +5 Pp.', 'Coach-Freigabe']),
('showup', 9, 'Showup-Rate erhöhen', 'Setting',
 array['No-Shows über 20 %', 'Lange Zeit zwischen Buchung und Call', 'Kein Commitment im Setting-Call'],
 'Showup-Rate unter 75 % über 2 Wochen',
 'Commitment im Setting (1–10)', 'Hast du im Setting ein klares Commitment geholt?', 8,
 '[{"title":"Persönliches Bestätigungs-Video","description":"30 Sek. direkt nach der Buchung","cadence":"Jede Buchung","duration":"2 Min"},{"title":"Commitment-Frage","description":"„Was hält dich davon ab zu erscheinen?“","cadence":"Jeder Setting-Call","duration":"1 Min"},{"title":"Reminder-Sequenz prüfen","description":"Wann, womit, wie persönlich?","cadence":"Einmalig","duration":"30 Min"}]',
 array['Showup ≥ 80 % über 2 Wochen', 'Video bei jeder Buchung', 'Coach-Freigabe']);
