#!/usr/bin/env node
/**
 * Erzeugt aus der lokalen Sicherung ein SQL-Skript für das neue Schema.
 *
 *   node scripts/seed-from-backup.mjs > /tmp/seed.sql
 *
 * Wird gebraucht, weil der Bestand aus einem anderen Backend stammt und
 * deshalb nicht über die legacy_-Tabellen übernommen werden kann. Das
 * Ergebnis läuft im SQL-Editor (Rolle postgres, umgeht RLS) und ist
 * wiederholbar: Firmen werden über den Namen abgeglichen, Deals über
 * Titel + Firma.
 */

import { readFileSync } from 'node:fs';

const backup = JSON.parse(
  readFileSync(new URL('../backup/lovable-cloud-2026-08-11.json', import.meta.url), 'utf8'),
);

/** Werte für SQL maskieren; einfache Anführungszeichen verdoppeln. */
const q = (value) =>
  value === null || value === undefined || value === '' ? 'null' : `'${String(value).replace(/'/g, "''")}'`;

/** Alte Phasenbezeichnung → Name der neuen Stage. */
const STAGE = {
  lead: 'Erstkontakt',
  qualified: 'Qualifiziert',
  proposal: 'Angebot',
  negotiation: 'Verhandlung',
  won: 'Verhandlung',
  lost: 'Verhandlung',
};

const out = [];

out.push('-- Aus backup/lovable-cloud-2026-08-11.json erzeugt. Nicht von Hand ändern.');
out.push('begin;');
out.push('');

/* --------------------------------------------------------------- Firmen -- */
out.push('-- Firmen');
for (const c of backup.companies) {
  const domain = c.website ? c.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '') : null;
  out.push(
    `insert into public.companies (name, city, industry, website, domain, description, status) ` +
      `select ${q(c.name)}, ${q(c.city)}, ${q(c.industry)}, ${q(c.website)}, ${q(domain)}, ${q(c.notes)}, ` +
      `${q(c.status)}::public.company_status ` +
      `where not exists (select 1 from public.companies where name = ${q(c.name)});`,
  );
}
out.push('');

/* -------------------------------------------------------------- Notizen -- */
out.push('-- Freitexte zusätzlich als Notiz, damit sie in der Zeitleiste stehen');
for (const c of backup.companies) {
  if (!c.notes) continue;
  out.push(
    `insert into public.notes (body, company_id) ` +
      `select ${q(c.notes)}, id from public.companies where name = ${q(c.name)} ` +
      `and not exists (select 1 from public.notes n where n.company_id = public.companies.id and n.body = ${q(c.notes)});`,
  );
}
out.push('');

/* ------------------------------------------------------------- Kontakte -- */
out.push('-- Kontakte');
for (const k of backup.contacts ?? []) {
  out.push(
    `insert into public.contacts (first_name, last_name, email, phone, job_title, company_id, status) ` +
      `select ${q(k.first_name)}, ${q(k.last_name)}, ${q(k.email)}, ${q(k.phone)}, ${q(k.job_title)}, ` +
      `(select id from public.companies where name = ${q(k.firma)}), ${q(k.status)}::public.contact_status ` +
      `where not exists (select 1 from public.contacts where first_name = ${q(k.first_name)} and last_name = ${q(k.last_name)});`,
  );
}
out.push('');

/* ---------------------------------------------------------------- Deals -- */
out.push('-- Deals');
backup.deals.forEach((d, index) => {
  const status = d.stage === 'won' ? 'won' : d.stage === 'lost' ? 'lost' : 'open';
  const wonAt = status === 'won' ? 'now()' : 'null';
  const lostAt = status === 'lost' ? 'now()' : 'null';

  out.push(
    `insert into public.deals (title, value, currency, pipeline_id, stage_id, company_id, status, ` +
      `probability, won_at, lost_at, position) ` +
      `select ${q(d.title)}, ${d.value}, ${q(d.currency)}, p.id, s.id, ` +
      `(select id from public.companies where name = ${q(d.firma)}), ${q(status)}::public.deal_status, ` +
      `${d.probability ?? 'null'}, ${wonAt}, ${lostAt}, ${(index + 1) * 1024} ` +
      `from public.pipelines p ` +
      `join public.stages s on s.pipeline_id = p.id and s.name = ${q(STAGE[d.stage])} ` +
      `where p.is_default ` +
      `and not exists (select 1 from public.deals x where x.title = ${q(d.title)} ` +
      `and x.company_id = (select id from public.companies where name = ${q(d.firma)}));`,
  );
});
out.push('');

/* ------------------------------------------------------------ Kontrolle -- */
out.push('commit;');
out.push('');
out.push(`select 'Firmen' pos, count(*)::text ist, '${backup.companies.length}' soll from public.companies`);
out.push(`union all select 'Kontakte', count(*)::text, '${(backup.contacts ?? []).length}' from public.contacts`);
out.push(`union all select 'Deals', count(*)::text, '${backup.deals.length}' from public.deals`);
out.push(
  `union all select 'Summe EUR', coalesce(sum(value),0)::text, '${backup._summen.gesamt.wert}' from public.deals`,
);
out.push(
  `union all select 'gewonnen EUR', coalesce(sum(value),0)::text, '${backup._summen.gewonnen.wert}' ` +
    `from public.deals where status = 'won'`,
);
out.push(`union all select 'Notizen', count(*)::text, '-' from public.notes;`);

console.log(out.join('\n'));
