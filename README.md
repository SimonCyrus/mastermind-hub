# Simon Cyrus MASTERMIND HUB

Trainingsplan-App für das Sales-Coaching: Jeder Teilnehmer arbeitet immer an genau einem Engpass
(Was · Warum · Wie · Messgröße · Abschlusskriterium), trackt seine Tageszahlen wie im bisherigen
Sheet und reflektiert jeden Call. Der Coach sieht alle Teilnehmer, Warnsignale und die Wirkung
seines Coachings.

**Technik:** Next.js 15 · Supabase (Login + Postgres-Datenbank, Region Frankfurt) · Hosting auf Vercel.

---

## Live gehen – Schritt für Schritt

### 1. Datenbank einrichten (Supabase)
1. Supabase-Projekt öffnen → links **SQL Editor** → **New query**.
2. Den kompletten Inhalt von `supabase/setup.sql` einfügen.
3. Ganz unten im Abschnitt **EINSTELLUNGEN** prüfen:
   - `coach_email` – mit dieser E-Mail registrierst du dich als Coach.
   - `invite_code` – den Code geben Teilnehmer bei der Registrierung ein (später in der App änderbar).
4. **Run** klicken. Fertig: Tabellen, Zugriffsrechte und 9 Engpass-Vorlagen sind angelegt.

### 2. Login konfigurieren (Supabase → Authentication)
- **URL Configuration → Site URL:** die Vercel-Adresse der App, z. B. `https://mastermind-hub.vercel.app`
- **Redirect URLs:** `https://mastermind-hub.vercel.app/**`
- **Sign In / Providers → Email:** „Confirm email“ kann aus bleiben, weil der Einladungscode
  Fremde schon fernhält. Wenn du Bestätigungsmails willst: unter **SMTP Settings** einen eigenen
  Mailversand eintragen (Supabase selbst verschickt nur sehr wenige Mails pro Stunde).

### 3. App veröffentlichen (Vercel)
1. vercel.com → **Add New → Project** → das GitHub-Repository importieren.
2. Unter **Environment Variables** eintragen (Werte aus Supabase → Project Settings → API):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon / publishable key)
   - `NEXT_PUBLIC_APP_TIMEZONE` = `Europe/Berlin`
3. **Deploy**.

### 4. Loslegen
1. App öffnen → **Konto erstellen** mit deiner Coach-E-Mail (Einladungscode egal).
2. Teilnehmern den Link + Einladungscode schicken. Sie registrieren sich selbst und durchlaufen
   das Onboarding (Rolle, Zielrechner, Selbstcheck → erster Engpass-Vorschlag).
3. Im ersten Call öffnest du den Teilnehmer, ergänzt Diagnose, Drills und Kriterien und klickst
   **Engpass aktivieren**.

Tipp fürs Handy: App im Browser öffnen → Teilen → „Zum Home-Bildschirm“.

---

## Was die App kann (Phase 1)

**Teilnehmer**
- Übersicht: aktueller Engpass mit Warum, heutigen Drills (abhakbar), Messgröße und Abschlusskriterien;
  Provision gegen Ziel, Closing-, Showup-Rate, Cash; Closing-Kurve über 12 Wochen mit Engpass-Phasen;
  Funnel; Einwand-Quoten mit Vorschlag für den nächsten Engpass; Engpass-Historie mit Vorher/Nachher.
- Tages-Check-in: alle Felder aus dem bisherigen Sheet, passend zur Rolle (Setter/Closer/beides),
  Nachtragen vergangener Tage, Live-Berechnung.
- Call-Reflexion: Ergebnis, Frage zum aktuellen Engpass (1–10), Einwände gelöst/offen, Notizen.
- Trainingsplan: Diagnose + Belege, Drills mit 7-Tage-Verlauf, Messkurve, Austausch mit dem Coach,
  nächsten Engpass vorschlagen.
- Ziele & Profil: Zielrechner (rückwärts wie im Sheet).

**Coach**
- Übersicht: Warnsignale (trackt nicht, Engpass stagniert ab Tag 21, Showup/Closing eingebrochen,
  Vorschlag wartet), Tabelle aller Teilnehmer, häufigste Engpässe, Wirkung pro Engpass.
- Teilnehmer-Detail: Engpass bearbeiten, aktivieren, als gelöst markieren; Kriterien abhaken;
  Drills anlegen/ändern/löschen; Austausch; private Notizen; Selbstcheck.
- Engpass-Bibliothek: Vorlagen ansehen, bearbeiten, neu anlegen.
- Einstellungen: Einladungscode ändern.

## Kennzahlen
Die Formeln entsprechen dem bisherigen Tracking-Sheet, mit drei Korrekturen:
Provision nutzt den hinterlegten Prozentsatz (im Sheet fest 10 %), Auslastung nutzt die eigenen
Slots (im Sheet fest 40) und geführte Calls werden nie negativ. Siehe `lib/metrics.ts`.

## Entwicklung
```bash
npm install
cp .env.example .env.local   # Werte eintragen
npm run dev                  # http://localhost:3000
npm test                     # Kennzahlen-Tests
```
Rechte-Tests der Datenbank: `tests/rls_test.sql` (gegen eine lokale Postgres mit `tests/supabase_stub.sql`).
