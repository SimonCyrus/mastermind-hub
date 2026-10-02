-- Rechte-Tests: laufen gegen tests/supabase_stub.sql + supabase/setup.sql
\set ON_ERROR_STOP 1

-- Konten anlegen (als Superuser, wie Supabase Auth es tut)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000c', 'SimonCyrus.web@gmail.com', '{"full_name":"Simon"}'),
  ('00000000-0000-0000-0000-00000000000a', 'a@test.de', '{"full_name":"Anna","invite_code":"MASTERMIND2026"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.de', '{"full_name":"Ben","invite_code":"MASTERMIND2026"}');

do $$ begin
  assert (select role from profiles where id = '00000000-0000-0000-0000-00000000000c') = 'coach', 'Coach per E-Mail erkannt';
  assert (select role from profiles where id = '00000000-0000-0000-0000-00000000000a') = 'participant', 'Teilnehmer';
end $$;

-- Falscher Einladungscode wird abgelehnt
do $$ begin
  begin
    insert into auth.users (email, raw_user_meta_data) values ('x@test.de', '{"invite_code":"FALSCH"}');
    raise exception 'FEHLER: falscher Code akzeptiert';
  exception when others then
    if sqlerrm not like '%Einladungscode%' then raise; end if;
  end;
end $$;

-- ---------------- Teilnehmer A ----------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

insert into daily_entries (participant_id, day, calendar_calls, one_call_closes, cash_collected) values ('00000000-0000-0000-0000-00000000000a', '2026-09-28', 5, 1, 2800);
insert into bottlenecks (id, participant_id, title, status, proposed_by) values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Menschlich rüberkommen', 'proposed', '00000000-0000-0000-0000-00000000000a');
insert into drills (id, bottleneck_id, title) values ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'Mimik');

do $$ begin
  assert (select seq from bottlenecks where id = '10000000-0000-0000-0000-00000000000a') = 1, 'Nummerierung';
  assert (select count(*) from profiles) = 2, 'A sieht eigenes Profil + Coach';
  assert (select count(*) from profiles where id = '00000000-0000-0000-0000-00000000000b') = 0, 'A sieht B nicht';
  assert (select count(*) from bottleneck_templates) = 9, 'A sieht Vorlagen';
  assert (select count(*) from app_settings) = 0, 'A sieht Einstellungen nicht';
end $$;

-- A darf sich nicht selbst zum Coach machen
do $$ begin
  begin
    update profiles set role = 'coach' where id = '00000000-0000-0000-0000-00000000000a';
    raise exception 'FEHLER: Rolle geändert';
  exception when others then
    if sqlerrm not like '%Rolle%' then raise; end if;
  end;
end $$;

-- A darf eigenen Engpass nicht selbst aktivieren
do $$ begin
  begin
    update bottlenecks set status = 'active' where id = '10000000-0000-0000-0000-00000000000a';
    raise exception 'FEHLER: selbst aktiviert';
  exception when others then
    if sqlerrm like 'FEHLER%' then raise; end if;
  end;
end $$;

-- A darf keine Vorlage ändern
do $$ declare n int; begin
  update bottleneck_templates set name = 'x';
  get diagnostics n = row_count;
  assert n = 0, 'Vorlagen geschützt';
end $$;

-- ---------------- Teilnehmer B ----------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ declare n int; begin
  assert (select count(*) from daily_entries) = 0, 'B sieht A''s Zahlen nicht';
  assert (select count(*) from bottlenecks) = 0, 'B sieht A''s Engpass nicht';
  assert (select count(*) from drills) = 0, 'B sieht A''s Drills nicht';
  update daily_entries set cash_collected = 0;
  get diagnostics n = row_count;
  assert n = 0, 'B kann A''s Zahlen nicht ändern';
end $$;
do $$ begin
  begin
    insert into daily_entries (participant_id, day) values ('00000000-0000-0000-0000-00000000000a', '2026-09-29');
    raise exception 'FEHLER: B schreibt für A';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into drill_logs (drill_id, participant_id, day) values ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '2026-09-29');
    raise exception 'FEHLER: B hakt A''s Drill ab';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into comments (bottleneck_id, author_id, body) values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'hi');
    raise exception 'FEHLER: B kommentiert bei A';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------- Coach ----------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
update bottlenecks set status = 'active', activated_at = now(), activated_by = '00000000-0000-0000-0000-00000000000c',
  criteria = '[{"label":"10 Calls reflektiert","done":false}]' where id = '10000000-0000-0000-0000-00000000000a';
insert into comments (bottleneck_id, author_id, body) values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c', 'Los gehts');
insert into coach_notes (participant_id, body) values ('00000000-0000-0000-0000-00000000000a', 'privat');
do $$ begin
  assert (select count(*) from profiles) = 3, 'Coach sieht alle Profile';
  assert (select count(*) from daily_entries) = 1, 'Coach sieht Zahlen';
  assert (select count(*) from app_settings) = 1, 'Coach sieht Einstellungen';
end $$;
-- Zweiter aktiver Engpass für A wird verhindert
do $$ begin
  begin
    insert into bottlenecks (participant_id, title, status) values ('00000000-0000-0000-0000-00000000000a', 'Zweiter', 'active');
    raise exception 'FEHLER: zwei aktive';
  exception when unique_violation then null;
  end;
end $$;

-- ---------------- Wieder A ----------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into drill_logs (drill_id, participant_id, day) values ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '2026-09-29');
insert into comments (bottleneck_id, author_id, body) values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Danke');
insert into call_reflections (participant_id, bottleneck_id, score, objections) values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 7, '[{"type":"angst_partner","solved":false}]');
do $$ declare n int; begin
  assert (select count(*) from comments) = 2, 'A sieht Austausch';
  assert (select count(*) from coach_notes) = 0, 'A sieht Coach-Notizen nicht';
  update bottlenecks set title = 'x';
  get diagnostics n = row_count;
  assert n = 0, 'A kann aktiven Engpass nicht ändern';
  -- Drills eines aktiven Engpasses darf A nicht löschen
  delete from drills;
  get diagnostics n = row_count;
  assert n = 0, 'A kann Drills nicht löschen';
end $$;

reset role;
select 'ALLE RECHTE-TESTS BESTANDEN' as ergebnis;

-- ---------------- Tagesplan ----------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into plan_days (participant_id, day, focus, method) values ('00000000-0000-0000-0000-00000000000a', '2026-10-05', 'Menschlich', '15 Min Mimik');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  assert (select count(*) from plan_days) = 0, 'B sieht A''s Tagesplan nicht';
  begin
    insert into plan_days (participant_id, day, focus) values ('00000000-0000-0000-0000-00000000000a', '2026-10-06', 'x');
    raise exception 'FEHLER: B plant für A';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
insert into plan_days (participant_id, day, focus) values ('00000000-0000-0000-0000-00000000000a', '2026-10-06', 'Pain');
do $$ begin assert (select count(*) from plan_days) = 2, 'Coach plant für A'; end $$;
reset role;
select 'TAGESPLAN-TESTS BESTANDEN' as ergebnis;
