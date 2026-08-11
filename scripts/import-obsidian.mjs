#!/usr/bin/env node
/**
 * Liest den Obsidian-Vault und erzeugt daraus SQL für das CRM.
 *
 *   node scripts/import-obsidian.mjs            # Übersicht, schreibt nichts
 *   node scripts/import-obsidian.mjs --sql      # SQL auf stdout
 *
 * Zwei Quellen:
 *   Kunden/*.md                    → Firmen (Status aus der Kopfzeile)
 *   Kaltakquise Kommunen/Übersicht → Kommunen als Firmen + Bürgermeister
 *                                    als Kontakte
 *
 * Das erzeugte SQL ist wiederholbar: alles läuft über
 * `where not exists (...)`, ein zweiter Lauf ändert nichts. Bestehende
 * Firmen werden nicht überschrieben — der CRM-Stand gilt als der neuere.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const VAULT = '/Users/admin/Desktop/MTM Studios/Obsidian/Tims 2. Gehirn';
const KUNDEN = join(VAULT, 'Kunden');
const KOMMUNEN = join(VAULT, 'MTM Studios/Kaltakquise Kommunen/Übersicht Kaltakquise Kommunen.md');

const q = (v) => (v === null || v === undefined || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`);

/* ------------------------------------------------------- Kundendateien -- */

/**
 * Die Statuszeile ist Freitext. Sie wird auf den CRM-Status abgebildet und
 * zusätzlich unverändert als Beschreibung übernommen — der Wortlaut trägt
 * mehr Information als das Enum.
 */
function mapStatus(text) {
  const t = (text ?? '').toLowerCase();
  if (t.includes('partnerschaft')) return 'partner';
  if (t.includes('leerer ordner') || t.includes('kein material')) return 'lead';
  if (t.includes('in bearbeitung') || t.includes('blueprint')) return 'prospect';
  if (
    t.includes('aktiv') || t.includes('live') || t.includes('beauftragt') || t.includes('pilot')
  ) {
    return 'customer';
  }
  return 'lead';
}

function ladeKunden() {
  return readdirSync(KUNDEN)
    .filter((f) => f.endsWith('.md') && f !== '00 Kunden Index.md')
    .map((f) => {
      const inhalt = readFileSync(join(KUNDEN, f), 'utf8');
      const status = inhalt.match(/^\*\*Status:\*\*\s*(.+)$/m)?.[1]?.trim() ?? null;
      const skills = [...inhalt.matchAll(/\[\[(mtm-[a-z-]+)\]\]/g)].map((m) => m[1]);
      return {
        name: f.replace(/\.md$/, ''),
        statusText: status,
        status: mapStatus(status),
        skills,
      };
    });
}

/* ------------------------------------------------------------ Kommunen -- */

const AMT = { BM: 'Bürgermeister', OB: 'Oberbürgermeister' };

/** „BM Dr. Ronald Scholz" → Titel, Vorname, Nachname */
function parsePerson(zelle) {
  const teile = zelle.trim().split(/\s+/);
  const amt = AMT[teile[0]] ?? null;
  let rest = amt ? teile.slice(1) : teile;

  let akademisch = null;
  if (rest[0] === 'Dr.' || rest[0] === 'Prof.') {
    akademisch = rest[0];
    rest = rest.slice(1);
  }
  if (!rest.length) return null;

  return {
    academic_title: akademisch,
    first_name: rest.slice(0, -1).join(' ') || null,
    last_name: rest.at(-1),
    job_title: amt,
  };
}

function ladeKommunen() {
  const zeilen = readFileSync(KOMMUNEN, 'utf8').split('\n');
  const out = [];

  for (const zeile of zeilen) {
    // | 1 | Denkendorf | Gemeinde | BM Ralf Barth | ✅ | Heimatgemeinde |
    const m = zeile.match(/^\|\s*(\d+)\s*\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]*)\|([^|]*)\|/);
    if (!m) continue;

    const [, , ort, typ, person, status, notiz] = m.map((s) => s.trim());
    const art = typ.trim();
    if (art !== 'Gemeinde' && art !== 'Stadt') continue;

    out.push({
      // Präfix, damit die Namen zu den bereits im CRM geführten Einträgen
      // passen ("Gemeinde Deizisau", "Stadt Leinfelden-Echterdingen")
      name: `${art} ${ort.trim()}`,
      ort: ort.trim(),
      typ: art,
      person: parsePerson(person),
      angeschrieben: status.includes('✅'),
      problem: status.includes('⚠'),
      notiz: notiz.trim() || null,
    });
  }
  return out;
}

/* --------------------------------------------------------------- Ablauf -- */

const kunden = ladeKunden();
const kommunen = ladeKommunen();
const sqlModus = process.argv.includes('--sql');

if (!sqlModus) {
  console.log(`Kundendateien: ${kunden.length}`);
  const nachStatus = {};
  for (const k of kunden) nachStatus[k.status] = (nachStatus[k.status] ?? 0) + 1;
  console.log(`  nach Status: ${JSON.stringify(nachStatus)}`);
  for (const k of kunden.slice(0, 5)) console.log(`  ${k.name} → ${k.status}`);
  console.log(`  …`);

  console.log(`\nKommunen: ${kommunen.length}`);
  console.log(`  angeschrieben: ${kommunen.filter((k) => k.angeschrieben).length}`);
  console.log(`  mit Problem:   ${kommunen.filter((k) => k.problem).length}`);
  console.log(`  mit Ansprechpartner: ${kommunen.filter((k) => k.person).length}`);
  for (const k of kommunen.slice(0, 3)) {
    console.log(`  ${k.name} — ${k.person?.job_title} ${k.person?.first_name} ${k.person?.last_name}`);
  }
  console.log(`\nMit --sql das SQL erzeugen.`);
  process.exit(0);
}

const out = ['-- Aus dem Obsidian-Vault erzeugt. Nicht von Hand ändern.', 'begin;', ''];

/* Firmen aus den Kundendateien */
out.push('-- Firmen aus Kunden/*.md');
for (const k of kunden) {
  out.push(
    `insert into public.companies (name, description, status) ` +
      `select ${q(k.name)}, ${q(k.statusText)}, ${q(k.status)}::public.company_status ` +
      `where not exists (select 1 from public.companies where lower(name) = lower(${q(k.name)}));`,
  );
}
out.push('');

/* Firmen aus den Kommunen */
out.push('-- Kommunen als Firmen');
for (const k of kommunen) {
  const beschreibung = [
    k.angeschrieben ? 'Kaltakquise: angeschrieben' : 'Kaltakquise: noch nicht kontaktiert',
    k.problem ? 'E-Mail-Adresse im Entwurf prüfen' : null,
    k.notiz,
  ]
    .filter(Boolean)
    .join(' · ');

  out.push(
    `insert into public.companies (name, city, industry, description, status) ` +
      `select ${q(k.name)}, ${q(k.ort)}, 'Öffentliche Verwaltung', ${q(beschreibung)}, 'lead'::public.company_status ` +
      `where not exists (select 1 from public.companies where lower(name) = lower(${q(k.name)}));`,
  );

  // Zwei Kommunen stehen bereits als Kunden im CRM und wurden oben deshalb
  // übersprungen. Ort und Branche fehlen dort — nur leere Felder auffüllen,
  // Bestehendes bleibt unangetastet.
  out.push(
    `update public.companies set city = coalesce(city, ${q(k.ort)}), ` +
      `industry = coalesce(industry, 'Öffentliche Verwaltung') ` +
      `where lower(name) = lower(${q(k.name)});`,
  );
}
out.push('');

/* Bürgermeister als Kontakte */
out.push('-- Ansprechpartner der Kommunen');
for (const k of kommunen) {
  if (!k.person) continue;
  const p = k.person;
  out.push(
    `insert into public.contacts (first_name, last_name, academic_title, job_title, company_id, status) ` +
      `select ${q(p.first_name)}, ${q(p.last_name)}, ${q(p.academic_title)}, ${q(p.job_title)}, ` +
      `c.id, 'lead'::public.contact_status ` +
      `from public.companies c where lower(c.name) = lower(${q(k.name)}) ` +
      `and not exists (select 1 from public.contacts x where x.company_id = c.id ` +
      `and x.last_name = ${q(p.last_name)});`,
  );
}
out.push('');

/* Tag für die Kaltakquise */
out.push('-- Kommunen als Kaltakquise markieren');
out.push(`insert into public.tags (label, color) select 'Kaltakquise', 'amber' ` +
  `where not exists (select 1 from public.tags where label = 'Kaltakquise');`);
for (const k of kommunen) {
  out.push(
    `insert into public.taggings (tag_id, entity, entity_id) ` +
      `select t.id, 'company', c.id from public.tags t, public.companies c ` +
      `where t.label = 'Kaltakquise' and lower(c.name) = lower(${q(k.name)}) ` +
      `on conflict do nothing;`,
  );
}
out.push('');

out.push('commit;');
out.push('');
out.push(`select 'Firmen gesamt' pos, count(*)::text n from public.companies`);
out.push(`union all select 'davon Kommunen', count(*)::text from public.companies where industry = 'Öffentliche Verwaltung'`);
out.push(`union all select 'Kontakte gesamt', count(*)::text from public.contacts`);
out.push(`union all select 'Bürgermeister', count(*)::text from public.contacts where job_title in ('Bürgermeister','Oberbürgermeister')`);
out.push(`union all select 'Deals (unverändert)', count(*)::text from public.deals;`);

console.log(out.join('\n'));
