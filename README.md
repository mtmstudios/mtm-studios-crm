# CRM

Internes CRM: Kontakte, Firmen, Deal-Pipeline, Aufgaben, Posteingang, Kalender
und Berichte.

Stack: React 18 · TypeScript · Vite · Tailwind · shadcn/ui · TanStack Query ·
Supabase (Postgres, Auth, Edge Functions).

---

## Einrichtung

### 1. Supabase-Projekt anlegen

Ein eigenes Projekt unter [supabase.com](https://supabase.com/dashboard) anlegen
(**nicht** Lovable Cloud — die Vorgängerprojekte dieses CRMs wurden dort
gelöscht und der komplette Datenbestand war verloren).

### 2. Schema einspielen

```bash
npx supabase link --project-ref <projekt-ref>
npx supabase db push
```

Die vier Migrationen in `supabase/migrations/` laufen der Reihe nach:

| Datei | Inhalt |
|---|---|
| `…_init_core.sql` | Tabellen, Enums, Trigger, Audit |
| `…_indexes_triggers_rls.sql` | Indizes und **RLS-Policies** |
| `…_functions.sql` | Suche, Board, Reporting, öffentliche Buchung |
| `…_default_config.sql` | Standard-Pipeline, Phasen, Verlustgründe, Tags |

### 3. Konfiguration

```bash
cp .env.example .env
```

und die Werte aus *Project Settings → API* eintragen.

### 4. Starten

```bash
npm install
npm run dev
```

**Der erste registrierte Account wird automatisch Admin.** Alle weiteren
Registrierungen werden Mitglied. Rollen lassen sich danach unter
*Einstellungen → Team* ändern.

### 5. Typen neu erzeugen (nach Schemaänderungen)

```bash
npx supabase gen types typescript --project-id <ref> > src/integrations/supabase/types.ts
```

`src/integrations/supabase/types.ts` ist derzeit handgeschrieben und passt zu
den Migrationen. Sobald das Projekt steht, ersetzt der Generator die Datei.

---

## Berechtigungen

Ein Mandant, ein Team. Jedes **aktive** Teammitglied sieht und bearbeitet die
gemeinsamen Daten — so arbeiten Pipedrive und HubSpot auch. `owner_id` ist eine
fachliche Zuordnung, keine Sichtbarkeitsgrenze.

- **Fachdaten** (Kontakte, Firmen, Deals, Aufgaben, Notizen, Termine,
  Unterhaltungen): volles CRUD für Mitglieder.
- **Konfiguration** (Pipelines, Phasen, Verlustgründe, Custom Fields): alle
  lesen, nur Admins ändern.
- **Audit-Log**: nur Admins lesen; geschrieben ausschließlich per Trigger.
- **Anonym**: keinerlei Tabellenrechte. Die öffentliche Buchungsseite läuft
  über drei `SECURITY DEFINER`-Funktionen (`booking_page`, `booking_slots`,
  `book_slot`), die genau das preisgeben, was die Seite braucht.

Es gibt bewusst **keine** `USING (true)`-Policy. Wer eine ergänzt, öffnet die
gesamte Datenbank für jeden, der den Anon-Key aus dem Browser-Bundle liest.

---

## sevDesk-Import

Übernimmt Organisationen als Firmen und Personen als Kontakte, inklusive
Adressen und Kommunikationswegen. Personen werden über `parent` ihrer Firma
zugeordnet.

```bash
node scripts/import-sevdesk.mjs            # Trockenlauf, schreibt nichts
node scripts/import-sevdesk.mjs --apply    # schreibt
```

Weitere Optionen:

```bash
node scripts/import-sevdesk.mjs --kategorie 3 --apply   # nur eine Kategorie
node scripts/import-sevdesk.mjs --limit 100             # zum Ausprobieren
```

Der Trockenlauf zeigt zuerst eine Verteilung der sevDesk-Kategorien an —
daran lässt sich ablesen, welche `--kategorie` die Kunden sind.

Der Abgleich läuft über `sevdesk_id` (unique). Ein zweiter Lauf legt also
keine Dubletten an, sondern aktualisiert. Das Skript läuft **nur lokal**;
Kundendaten landen nie im Repository.

---

## Posteingang

Eingehende SMS und WhatsApp kommen über `supabase/functions/twilio-webhook`.
Der Endpunkt ist öffentlich erreichbar und prüft deshalb bei jeder Anfrage die
Twilio-Signatur.

```bash
supabase functions deploy twilio-webhook --no-verify-jwt
supabase secrets set \
  TWILIO_AUTH_TOKEN=... \
  PUBLIC_WEBHOOK_URL=https://<ref>.supabase.co/functions/v1/twilio-webhook
```

`PUBLIC_WEBHOOK_URL` muss **exakt** der bei Twilio hinterlegten URL entsprechen —
die Signatur wird über diese Zeichenkette gebildet.

Der **ausgehende** Versand ist noch nicht angebunden: Antworten aus der
Oberfläche werden im Verlauf festgehalten, aber nicht verschickt. Dafür fehlen
die Zugangsdaten des Anbieters.

---

## Deployment

Produktiv auf Vercel: **https://mtm-studios-crm.vercel.app**

Projekt `mtm-studios-crm` (Team `mtmstudios-projects`), verbunden mit diesem
Repo. Jeder Push auf `main` löst einen Build aus. Die beiden `VITE_`-Variablen
sind unter *Settings → Environment Variables* für Production und Preview
hinterlegt.

In Supabase sind unter *Authentication → URL Configuration* eingetragen:

- Site URL: `https://mtm-studios-crm.vercel.app`
- Redirect URLs: die Vercel-Domain und `http://localhost:8080/**`

Ohne diese Einträge zeigen Bestätigungs- und Passwortlinks ins Leere.

---

## Befehle

```bash
npm run dev        # Entwicklungsserver auf :8080
npm run build      # Produktions-Build
npm run lint       # ESLint
npm test           # Vitest
```

---

## Aufbau

```
src/
  features/<modul>/api.ts   Datenzugriff je Modul (TanStack Query)
  pages/<modul>/            Seiten
  components/data/          Tabelle, Filterleiste, Paginierung
  components/crm/           Zeitleiste, Dialoge, Bausteine
  components/ui/            shadcn/ui
  lib/list.ts               Listenzustand (Suche, Filter, Sortierung, Seiten)
  lib/format.ts             Datums-, Zahlen- und Namensformatierung
supabase/
  migrations/               Schema
  functions/                Edge Functions
scripts/                    Einmalige Betriebsskripte (laufen lokal)
```

Der Listenzustand steckt in der URL (`?q=…&f_status=lead&page=2`). Gefilterte
Ansichten sind damit teilbar und der Zurück-Button funktioniert.
