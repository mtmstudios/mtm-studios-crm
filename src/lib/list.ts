/**
 * Der Filter-Builder von PostgREST trägt acht Generics, die sich zwischen
 * Minor-Versionen verschieben. Ihn direkt als Constraint zu verwenden treibt
 * den Typechecker in „excessively deep instantiation" — deshalb hier nur die
 * drei tatsächlich benutzten Methoden, nicht-rekursiv.
 */
interface FilterLike {
  or(filter: string): FilterLike;
  in(column: string, values: readonly string[]): FilterLike;
  is(column: string, value: null): FilterLike;
}

/**
 * Gemeinsamer Zustand aller Listenansichten. Landet 1:1 in der URL, damit
 * ein gefilterter Stand teilbar und über den Zurück-Button erreichbar ist.
 */
export interface ListParams {
  search: string;
  page: number;
  pageSize: number;
  sort: string;
  asc: boolean;
  filters: Record<string, string[]>;
}

export interface ListResult<T> {
  rows: T[];
  total: number;
  pageCount: number;
}

export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZES = [25, 50, 100];

export function defaultParams(sort: string, asc = false): ListParams {
  return { search: '', page: 1, pageSize: DEFAULT_PAGE_SIZE, sort, asc, filters: {} };
}

/**
 * Liest den Listenzustand aus den Query-Parametern der URL.
 * Filter werden als `f_<spalte>=a,b` abgelegt.
 */
export function paramsFromSearch(sp: URLSearchParams, fallbackSort: string, fallbackAsc = false): ListParams {
  const filters: Record<string, string[]> = {};
  sp.forEach((value, key) => {
    if (key.startsWith('f_') && value) filters[key.slice(2)] = value.split(',');
  });

  const size = Number(sp.get('size'));
  return {
    search: sp.get('q') ?? '',
    page: Math.max(1, Number(sp.get('page')) || 1),
    pageSize: PAGE_SIZES.includes(size) ? size : DEFAULT_PAGE_SIZE,
    sort: sp.get('sort') ?? fallbackSort,
    asc: sp.has('asc') ? sp.get('asc') === '1' : fallbackAsc,
    filters,
  };
}

export function searchFromParams(p: ListParams, fallbackSort: string, fallbackAsc = false): URLSearchParams {
  const sp = new URLSearchParams();
  // Nur abweichende Werte in die URL schreiben — hält sie lesbar.
  if (p.search) sp.set('q', p.search);
  if (p.page > 1) sp.set('page', String(p.page));
  if (p.pageSize !== DEFAULT_PAGE_SIZE) sp.set('size', String(p.pageSize));
  if (p.sort !== fallbackSort) sp.set('sort', p.sort);
  if (p.asc !== fallbackAsc) sp.set('asc', p.asc ? '1' : '0');
  for (const [key, values] of Object.entries(p.filters)) {
    if (values.length) sp.set(`f_${key}`, values.join(','));
  }
  return sp;
}

/** Stabiler Query-Key: Filterreihenfolge darf keinen Cache-Miss erzeugen. */
export function listKey(p: ListParams): unknown {
  const filters = Object.entries(p.filters)
    .filter(([, v]) => v.length)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => [k, [...v].sort()]);
  return { q: p.search, page: p.page, size: p.pageSize, sort: p.sort, asc: p.asc, filters };
}

/**
 * PostgREST behandelt Kommas, Klammern und Punkte in `or()` als Syntax.
 * Ohne Maskierung bricht eine Suche nach „Müller, GmbH" die Abfrage —
 * oder lässt fremde Bedingungen einschleusen.
 */
export function escapeLike(term: string): string {
  return term.replace(/[,().*\\]/g, (m) => `\\${m}`);
}

/** Bereich für PostgREST `.range()` aus Seite und Seitengröße. */
export function pageRange(p: ListParams): [number, number] {
  const from = (p.page - 1) * p.pageSize;
  return [from, from + p.pageSize - 1];
}

/**
 * Mehrwertige Filter anwenden: leer = kein Filter, sonst `IN (...)`.
 * Der Builder wird für die Dauer der Funktion auf `FilterLike` reduziert und
 * am Ende wieder als der ursprüngliche Typ zurückgegeben — die Kette bleibt
 * an der Aufrufstelle damit voll typisiert.
 */
export function applyFilters<T>(
  query: T,
  filters: Record<string, string[]>,
  allowed: string[],
): T {
  let q = query as FilterLike;
  for (const column of allowed) {
    const values = filters[column];
    if (!values?.length) continue;
    // "none" steht in der Oberfläche für „nicht gesetzt"
    const real = values.filter((v) => v !== 'none');
    const wantsNull = values.includes('none');

    if (wantsNull && real.length) {
      q = q.or(`${column}.in.(${real.join(',')}),${column}.is.null`);
    } else if (wantsNull) {
      q = q.is(column, null);
    } else {
      q = q.in(column, real);
    }
  }
  return q as T;
}

export function toResult<T>(rows: T[] | null, count: number | null, pageSize: number): ListResult<T> {
  const total = count ?? 0;
  return { rows: rows ?? [], total, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}
