#!/usr/bin/env node
/**
 * Übernimmt Rechnungsdaten aus sevDesk ins CRM.
 *
 *   node scripts/import-sevdesk.mjs           # Übersicht, schreibt nichts
 *   node scripts/import-sevdesk.mjs --sql     # SQL auf stdout
 *
 * Braucht SEVDESK_API_TOKEN in .env (sevDesk → Einstellungen → Benutzer).
 * Läuft lokal; Kundendaten landen nie im Repository.
 *
 * Der Bestand in sevDesk trägt die *Rechnungsnamen* ("factonet Holding GmbH"),
 * das CRM die Arbeitsnamen ("factonet"). Deshalb wird nicht stumpf angelegt,
 * sondern:
 *
 *   - bekannte Entsprechungen (ZUORDNUNG) reichern die bestehende Firma an:
 *     legal_name, Kundennummer, USt-IdNr., Anschrift, Telefon, E-Mail.
 *     Der Anzeigename im CRM bleibt unangetastet.
 *   - alles Übrige wird als neue Firma angelegt.
 *   - AUSNAHMEN werden übersprungen, mit Begründung.
 *
 * Alle Anweisungen sind wiederholbar; bestehende Werte werden nur dort
 * gesetzt, wo im CRM noch nichts steht (coalesce).
 */

import { readFileSync } from 'node:fs';

const API = 'https://my.sevdesk.de/api/v1';

/**
 * sevDesk-Kontakt-ID → bestehende CRM-Firma.
 *
 * Bewusst über die ID und nicht über den Namen: die Namen in sevDesk sind
 * teils Rechnungsnamen, teils Textblöcke (siehe 129135224, dort steht die
 * komplette Anschrift samt Telefon im Namensfeld). Die ID ist stabil.
 *
 * `legalName: null` unterdrückt die Übernahme des Rechnungsnamens dort, wo
 * er unbrauchbar ist.
 */
const ZUORDNUNG = new Map([
  [135710064, { crm: 'Conplaning GmbH' }],
  [133455924, { crm: 'Deco & More' }],
  [131914619, { crm: 'Autohaus Durst' }],
  [131165802, { crm: 'Gemeinde Deizisau' }],
  [129348883, { crm: 'factonet' }],
  // Namensfeld enthält Anschrift + Telefon + E-Mail — nicht als legal_name
  // übernehmen. Die Anschrift kommt sauber aus ContactAddress.
  [129135224, { crm: 'SJ Design', legalName: 'SJ-Design' }],
  // Über Info@schreinerei-krickl.de eindeutig belegt
  [123342396, { crm: 'schreinerei krickl' }],
  // Von Tim bestätigt: Rechnungsträger des Reha-Zentrums
  [129133674, { crm: 'Reinker Reha-Zentrum Markkleeberg' }],
]);

/** Nicht ins CRM — mit Grund, damit später niemand rätselt. */
const AUSNAHMEN = new Map([
  [136195346, 'Meta Platforms Ireland Limited — Lieferant (Werbung), kein Kunde'],
  [129133656, 'Reiner Med GmbH — Vertipper-Dublette von „Reinker Med GmbH", 10 s später angelegt'],
]);

/* ------------------------------------------------------------- Konfig -- */

function ladeEnv() {
  try {
    for (const zeile of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
      const m = zeile.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* .env ist optional */
  }
}

ladeEnv();

const TOKEN = process.env.SEVDESK_API_TOKEN;
if (!TOKEN) {
  console.error('SEVDESK_API_TOKEN fehlt in .env.');
  process.exit(1);
}

const sqlModus = process.argv.includes('--sql');
const q = (v) => (v === null || v === undefined || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const putz = (v) => {
  const s = (v ?? '').toString().trim();
  return s === '' ? null : s;
};

/* ---------------------------------------------------------- sevDesk API -- */

async function hole(pfad) {
  const res = await fetch(`${API}${pfad}?limit=500`, {
    headers: { Authorization: TOKEN, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`sevDesk ${pfad} → HTTP ${res.status}`);
  return (await res.json()).objects ?? [];
}

/** Kommunikationswege bündeln; der als „main" markierte gewinnt. */
function kommunikation(wege) {
  const nachTyp = {};
  for (const w of wege) {
    const typ = (w.type ?? '').toUpperCase();
    if (!nachTyp[typ] || String(w.main) === '1') nachTyp[typ] = putz(w.value);
  }
  return {
    email: nachTyp.EMAIL ?? null,
    phone: nachTyp.PHONE ?? nachTyp.MOBILE ?? null,
    website: nachTyp.WEB ?? null,
  };
}

/**
 * Arbeitsname aus dem Rechnungsnamen ableiten. Bewusst nur zwei Regeln —
 * mehr Automatik würde Namen verfälschen, die absichtlich so lauten.
 */
function arbeitsname(name) {
  return (
    name
      // "Räumzwerge Inh. Adem Kekec" → "Räumzwerge"
      .replace(/\s+Inh\.\s+.*$/i, '')
      // Angehängte Anschrift: "… Straße 17 73779 Ort"
      .replace(/\s+\S*(?:straße|str\.)\s+\d+.*$/i, '')
      .trim() || name
  );
}

/* --------------------------------------------------------------- Ablauf -- */

const [kontakte, adressen, wege] = await Promise.all([
  hole('/Contact'),
  hole('/ContactAddress'),
  hole('/CommunicationWay'),
]);

const gruppiere = (zeilen) => {
  const map = new Map();
  for (const z of zeilen) {
    const id = z.contact?.id;
    if (!id) continue;
    (map.get(id) ?? map.set(id, []).get(id)).push(z);
  }
  return map;
};

const adressenVon = gruppiere(adressen);
const wegeVon = gruppiere(wege);

const zusammengefuehrt = [];
const neu = [];
const uebersprungen = [];

for (const k of kontakte) {
  const name = putz(k.name);
  if (!name) continue;

  const id = Number(k.id);

  if (AUSNAHMEN.has(id)) {
    uebersprungen.push({ grund: AUSNAHMEN.get(id) });
    continue;
  }

  const eintrag = ZUORDNUNG.get(id);
  const adresse = (adressenVon.get(k.id) ?? [])[0] ?? {};
  const satz = {
    // Ein `legalName` in der Zuordnung überschreibt den Rohnamen; null
    // unterdrückt die Übernahme ganz.
    legal_name: eintrag && 'legalName' in eintrag ? eintrag.legalName : name,
    customer_number: putz(k.customerNumber),
    vat_number: putz(k.vatNumber),
    tax_number: putz(k.taxNumber),
    street: putz(adresse.street),
    zip: putz(adresse.zip),
    city: putz(adresse.city),
    sevdesk_id: String(k.id),
    ...kommunikation(wegeVon.get(k.id) ?? []),
  };

  if (eintrag) zusammengefuehrt.push({ ...satz, crm: eintrag.crm, quelle: name });
  else neu.push({ ...satz, name: arbeitsname(name) });
}

/* ------------------------------------------------------------ Übersicht -- */

if (!sqlModus) {
  console.log(`sevDesk: ${kontakte.length} Datensätze\n`);

  console.log(`An bestehende Firmen angehängt (${zusammengefuehrt.length}):`);
  for (const z of zusammengefuehrt) {
    console.log(`  ${z.crm.padEnd(36)} ← ${z.quelle.slice(0, 44)}`);
  }

  console.log(`\nNeu angelegt (${neu.length}):`);
  for (const n of neu) {
    const ort = [n.zip, n.city].filter(Boolean).join(' ');
    console.log(`  KdNr ${String(n.customer_number ?? '—').padEnd(6)}${n.name.padEnd(30)}${ort || '—'}`);
  }

  console.log(`\nÜbersprungen (${uebersprungen.length}):`);
  for (const u of uebersprungen) console.log(`  ${u.grund}`);

  console.log('\nMit --sql das SQL erzeugen.');
  process.exit(0);
}

/* ----------------------------------------------------------------- SQL -- */

const out = ['-- Aus sevDesk erzeugt. Nicht von Hand ändern.', 'begin;', ''];

out.push('-- Bestehende Firmen um die Rechnungsdaten ergänzen.');
out.push('-- coalesce: nur füllen, was im CRM noch leer ist.');
for (const z of zusammengefuehrt) {
  out.push(
    `update public.companies set ` +
      `legal_name = coalesce(legal_name, ${q(z.legal_name)}), ` +
      `customer_number = coalesce(customer_number, ${q(z.customer_number)}), ` +
      `vat_number = coalesce(vat_number, ${q(z.vat_number)}), ` +
      `tax_number = coalesce(tax_number, ${q(z.tax_number)}), ` +
      `street = coalesce(street, ${q(z.street)}), ` +
      `zip = coalesce(zip, ${q(z.zip)}), ` +
      `city = coalesce(city, ${q(z.city)}), ` +
      `phone = coalesce(phone, ${q(z.phone)}), ` +
      `email = coalesce(email, ${q(z.email)}), ` +
      `sevdesk_id = coalesce(sevdesk_id, ${q(z.sevdesk_id)}), ` +
      // Wer eine Rechnung bekommen hat, ist Kunde
      `status = 'customer'::public.company_status ` +
      `where lower(name) = lower(${q(z.crm)});`,
  );
}
out.push('');

out.push('-- Firmen, die es im CRM noch nicht gibt');
for (const n of neu) {
  out.push(
    `insert into public.companies (name, legal_name, customer_number, vat_number, tax_number, ` +
      `street, zip, city, phone, email, website, sevdesk_id, status) ` +
      `select ${q(n.name)}, ${q(n.legal_name)}, ${q(n.customer_number)}, ${q(n.vat_number)}, ` +
      `${q(n.tax_number)}, ${q(n.street)}, ${q(n.zip)}, ${q(n.city)}, ${q(n.phone)}, ${q(n.email)}, ` +
      `${q(n.website)}, ${q(n.sevdesk_id)}, 'customer'::public.company_status ` +
      `where not exists (select 1 from public.companies ` +
      `where lower(name) = lower(${q(n.name)}) or sevdesk_id = ${q(n.sevdesk_id)});`,
  );
}
out.push('');

for (const u of uebersprungen) {
  out.push(`-- übersprungen: ${u.grund}`);
}
out.push('');

out.push('commit;');
out.push('');
out.push(`select 'Firmen gesamt' pos, count(*)::text n from public.companies`);
out.push(`union all select 'mit Kundennummer', count(*)::text from public.companies where customer_number is not null`);
out.push(`union all select 'mit sevDesk-Verknüpfung', count(*)::text from public.companies where sevdesk_id is not null`);
out.push(`union all select 'Status Kunde', count(*)::text from public.companies where status = 'customer'`);
out.push(`union all select 'Deals (unverändert)', count(*)::text from public.deals;`);

console.log(out.join('\n'));
