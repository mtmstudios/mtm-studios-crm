#!/usr/bin/env node
/**
 * Kunden- und Kontaktdaten aus sevDesk ins CRM übernehmen.
 *
 *   node scripts/import-sevdesk.mjs              # Trockenlauf, schreibt nichts
 *   node scripts/import-sevdesk.mjs --apply      # schreibt tatsächlich
 *   node scripts/import-sevdesk.mjs --kategorie 3 --apply
 *
 * Läuft ausschließlich lokal. Die Daten landen direkt in Supabase und nie
 * im Repository.
 *
 * Benötigte Werte in .env:
 *   SEVDESK_API_TOKEN=...
 *   VITE_SUPABASE_URL=https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=...      (Service-Rolle, nicht der Anon-Key)
 *
 * Der Import ist wiederholbar: Datensätze werden über sevdesk_id abgeglichen,
 * ein zweiter Lauf legt keine Dubletten an, sondern aktualisiert.
 */

import { readFileSync, appendFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const API = 'https://my.sevdesk.de/api/v1';
const PAGE = 100;
const PROTOCOL = 'sevdesk-import.jsonl';

/* ------------------------------------------------------------- Konfig -- */

function loadEnv() {
  try {
    for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      // Anführungszeichen entfernen, die manche Editoren mitschreiben
      const value = match[2].replace(/^["']|["']$/g, '');
      if (!process.env[match[1]]) process.env[match[1]] = value;
    }
  } catch {
    // .env ist optional, wenn die Werte schon in der Umgebung stehen
  }
}

loadEnv();

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const LIMIT = Number(args[args.indexOf('--limit') + 1]) || Infinity;
const CATEGORY = args.includes('--kategorie')
  ? String(args[args.indexOf('--kategorie') + 1])
  : null;

const TOKEN = process.env.SEVDESK_API_TOKEN;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!TOKEN) {
  console.error('SEVDESK_API_TOKEN fehlt. In .env eintragen (sevDesk → Einstellungen → Benutzer → API-Token).');
  process.exit(1);
}
if (APPLY && (!SUPABASE_URL || !SERVICE_KEY)) {
  console.error('Für --apply werden VITE_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY benötigt.');
  process.exit(1);
}

/* --------------------------------------------------------- sevDesk API -- */

async function sevdesk(path, params = {}) {
  const url = new URL(API + path);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));

  const res = await fetch(url, {
    headers: { Authorization: TOKEN, Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`sevDesk ${path} → HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return (await res.json()).objects ?? [];
}

/** Alle Seiten einer Ressource holen. */
async function fetchAll(path, params = {}, label = path) {
  const out = [];
  for (let offset = 0; ; offset += PAGE) {
    const batch = await sevdesk(path, { ...params, limit: PAGE, offset });
    out.push(...batch);
    process.stdout.write(`\r  ${label}: ${out.length}`);
    if (batch.length < PAGE || out.length >= LIMIT) break;
  }
  process.stdout.write('\n');
  return out;
}

/* ---------------------------------------------------------- Zuordnung -- */

const clean = (value) => {
  const trimmed = (value ?? '').toString().trim();
  return trimmed === '' ? null : trimmed;
};

/**
 * sevDesk kennt Organisationen und Personen in derselben Tabelle:
 * Organisationen haben `name`, Personen `surename`/`familyname`.
 */
const isOrganisation = (contact) =>
  !clean(contact.surename) && !clean(contact.familyname) && !!clean(contact.name);

/** Kommunikationswege eines Kontakts nach Typ bündeln; „main" gewinnt. */
function pickCommunication(ways) {
  const byType = {};
  for (const way of ways) {
    const type = (way.type ?? '').toUpperCase();
    // main === '1' markiert den bevorzugten Eintrag
    if (!byType[type] || String(way.main) === '1') byType[type] = clean(way.value);
  }
  return {
    email: byType.EMAIL ?? null,
    phone: byType.PHONE ?? null,
    mobile: byType.MOBILE ?? null,
    website: byType.WEB ?? null,
  };
}

function pickAddress(addresses) {
  if (!addresses.length) return {};
  // Die erste Adresse ist in sevDesk die Hauptadresse
  const address = addresses[0];
  return {
    street: clean(address.street),
    zip: clean(address.zip),
    city: clean(address.city),
  };
}

/* ------------------------------------------------------------- Ablauf -- */

function log(entry) {
  appendFileSync(PROTOCOL, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
}

async function main() {
  console.log(APPLY ? '» Import (schreibend)\n' : '» Trockenlauf — es wird nichts geschrieben\n');

  console.log('Lade aus sevDesk:');
  const [contacts, addresses, communications] = await Promise.all([
    fetchAll('/Contact', CATEGORY ? { 'category[id]': CATEGORY, 'category[objectName]': 'Category' } : {}, 'Kontakte'),
    fetchAll('/ContactAddress', {}, 'Adressen'),
    fetchAll('/CommunicationWay', {}, 'Kommunikationswege'),
  ]);

  // Nach Kontakt-ID gruppieren, damit die Zuordnung ohne N+1-Abfragen geht
  const groupByContact = (rows) => {
    const map = new Map();
    for (const row of rows) {
      const id = row.contact?.id;
      if (!id) continue;
      const list = map.get(id);
      if (list) list.push(row);
      else map.set(id, [row]);
    }
    return map;
  };

  const addressesBy = groupByContact(addresses);
  const commsBy = groupByContact(communications);

  const categories = {};
  for (const contact of contacts) {
    const key = contact.category?.id ?? 'ohne';
    categories[key] = (categories[key] ?? 0) + 1;
  }

  const organisations = contacts.filter(isOrganisation);
  const people = contacts.filter((c) => !isOrganisation(c));

  console.log(`\nGefunden: ${contacts.length} Datensätze`);
  console.log(`  Organisationen → Firmen:  ${organisations.length}`);
  console.log(`  Personen       → Kontakte: ${people.length}`);
  console.log(`  Kategorien (sevDesk-ID → Anzahl): ${JSON.stringify(categories)}`);
  if (!CATEGORY) {
    console.log('  Hinweis: mit --kategorie <id> lässt sich auf eine Kategorie einschränken.\n');
  }

  /* Firmen aufbereiten */
  const companyRows = organisations.map((org) => {
    const comm = pickCommunication(commsBy.get(org.id) ?? []);
    return {
      sevdesk_id: String(org.id),
      name: clean(org.name),
      customer_number: clean(org.customerNumber),
      vat_number: clean(org.vatNumber),
      tax_number: clean(org.taxNumber),
      description: clean(org.description),
      email: comm.email,
      phone: comm.phone,
      website: comm.website,
      status: 'customer',
      ...pickAddress(addressesBy.get(org.id) ?? []),
    };
  });

  /* Personen aufbereiten */
  const contactRows = people.map((person) => {
    const comm = pickCommunication(commsBy.get(person.id) ?? []);
    return {
      sevdesk_id: String(person.id),
      first_name: clean(person.surename),
      last_name: clean(person.familyname),
      academic_title: clean(person.academicTitle),
      description: clean(person.description),
      email: comm.email,
      phone: comm.phone,
      mobile: comm.mobile,
      status: 'active',
      // Wird nach dem Firmen-Import auf die CRM-UUID aufgelöst
      _parentSevdeskId: person.parent?.id ? String(person.parent.id) : null,
      ...pickAddress(addressesBy.get(person.id) ?? []),
    };
  });

  const withoutName = contactRows.filter((c) => !c.first_name && !c.last_name);
  if (withoutName.length) {
    console.log(`  ${withoutName.length} Personen ohne Namen werden übersprungen.`);
  }
  const importableContacts = contactRows.filter((c) => c.first_name || c.last_name);

  if (!APPLY) {
    console.log('\nBeispiele:');
    for (const row of companyRows.slice(0, 3)) {
      console.log(`  Firma:   ${row.name} · ${row.city ?? '—'} · ${row.email ?? '—'}`);
    }
    for (const row of importableContacts.slice(0, 3)) {
      console.log(
        `  Kontakt: ${[row.first_name, row.last_name].filter(Boolean).join(' ')} · ${row.email ?? '—'}`,
      );
    }
    console.log(
      `\nWürde schreiben: ${companyRows.length} Firmen, ${importableContacts.length} Kontakte.`,
    );
    console.log('Mit --apply ausführen, um den Import wirklich durchzuführen.');
    return;
  }

  /* Schreiben */
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  console.log('\nSchreibe Firmen …');
  const companyIdBySevdesk = new Map();

  for (let i = 0; i < companyRows.length; i += 200) {
    const batch = companyRows.slice(i, i + 200);
    const { data, error } = await supabase
      .from('companies')
      // sevdesk_id ist unique — ein zweiter Lauf aktualisiert statt zu doppeln
      .upsert(batch, { onConflict: 'sevdesk_id' })
      .select('id, sevdesk_id');

    if (error) {
      log({ schritt: 'firmen', von: i, fehler: error.message });
      console.error(`  Fehler ab Datensatz ${i}: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    for (const row of data ?? []) companyIdBySevdesk.set(row.sevdesk_id, row.id);
    process.stdout.write(`\r  ${Math.min(i + 200, companyRows.length)}/${companyRows.length}`);
  }
  console.log(`\n  ${companyIdBySevdesk.size} Firmen angelegt oder aktualisiert.`);

  console.log('Schreibe Kontakte …');
  let linked = 0;
  const preparedContacts = importableContacts.map(({ _parentSevdeskId, ...row }) => {
    const companyId = _parentSevdeskId ? companyIdBySevdesk.get(_parentSevdeskId) : null;
    if (companyId) linked++;
    return { ...row, company_id: companyId ?? null };
  });

  let written = 0;
  for (let i = 0; i < preparedContacts.length; i += 200) {
    const batch = preparedContacts.slice(i, i + 200);
    const { data, error } = await supabase
      .from('contacts')
      .upsert(batch, { onConflict: 'sevdesk_id' })
      .select('id');

    if (error) {
      log({ schritt: 'kontakte', von: i, fehler: error.message });
      console.error(`  Fehler ab Datensatz ${i}: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    written += data?.length ?? 0;
    process.stdout.write(`\r  ${Math.min(i + 200, preparedContacts.length)}/${preparedContacts.length}`);
  }

  console.log(`\n  ${written} Kontakte angelegt oder aktualisiert, davon ${linked} einer Firma zugeordnet.`);
  log({ schritt: 'fertig', firmen: companyIdBySevdesk.size, kontakte: written, verknuepft: linked });
  console.log(`\nFertig. Protokoll: ${PROTOCOL}`);
}

main().catch((err) => {
  console.error('\nAbbruch:', err.message);
  log({ schritt: 'abbruch', fehler: err.message });
  process.exit(1);
});
