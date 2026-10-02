-- =====================================================================
-- Update 002 · Tagesplan im Trainingskalender
-- Einmal im Supabase SQL-Editor ausführen (New query → einfügen → Run).
-- =====================================================================
create table if not exists public.plan_days (
  participant_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  focus text not null default '' check (length(focus) <= 120),
  method text not null default '' check (length(method) <= 1000),
  done boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (participant_id, day)
);

alter table public.plan_days enable row level security;
grant select, insert, update, delete on public.plan_days to authenticated;

drop policy if exists plan_days_access on public.plan_days;
create policy plan_days_access on public.plan_days for all to authenticated
  using (participant_id = auth.uid() or public.is_coach())
  with check (participant_id = auth.uid() or public.is_coach());
