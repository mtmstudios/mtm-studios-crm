import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * PostgREST braucht bei mehreren Fremdschlüsseln zwischen zwei Tabellen einen
 * Hinweis, welcher gemeint ist. Dafür gibt es zwei Formen:
 *
 *   profiles!companies_owner_id_fkey   → Name des Constraints
 *   profiles!owner_id                  → Name der Spalte
 *
 * Die erste bricht, sobald Postgres den Constraint anders benennt — was
 * passiert, sobald der Name schon vergeben ist: dann hängt Postgres eine
 * Ziffer an (`..._fkey1`). Genau das ist im produktiven Backend eingetreten,
 * weil die legacy_-Tabellen die ursprünglichen Namen behalten hatten. Die
 * Abfragen liefen in PGRST200 und die Oberfläche zeigte „keine Daten".
 *
 * Die Spaltenform ist davon unabhängig und deshalb die einzige zulässige.
 */
describe('PostgREST-Einbettungen', () => {
  // import.meta.url zeigt unter vitest auf einen virtuellen Pfad, deshalb
  // vom Projektverzeichnis aus auflösen.
  const dir = join(process.cwd(), 'src/features');

  const apiFiles = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => join(dir, e.name, 'api.ts'))
    .filter((p) => {
      try {
        readFileSync(p);
        return true;
      } catch {
        return false;
      }
    });

  it('findet die API-Dateien', () => {
    expect(apiFiles.length).toBeGreaterThan(4);
  });

  it.each(apiFiles.map((p) => [p.split('/').slice(-2).join('/'), p]))(
    '%s verwendet keine Constraint-Namen als Hinweis',
    (_name, path) => {
      const source = readFileSync(path, 'utf8');
      const treffer = source.match(/!\w*_fkey\d*/g) ?? [];
      expect(treffer).toEqual([]);
    },
  );

  it.each(apiFiles.map((p) => [p.split('/').slice(-2).join('/'), p]))(
    '%s benennt bei Hinweisen eine Spalte',
    (_name, path) => {
      const source = readFileSync(path, 'utf8');
      const hinweise = source.match(/!(\w+)\(/g) ?? [];
      for (const h of hinweise) {
        const spalte = h.slice(1, -1);
        // Spaltennamen enden hier durchweg auf _id oder _by
        expect(spalte).toMatch(/_(id|by)$/);
      }
    },
  );
});
