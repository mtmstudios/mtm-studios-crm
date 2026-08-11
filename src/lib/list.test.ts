import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE_SIZE,
  applyFilters,
  defaultParams,
  escapeLike,
  listKey,
  pageRange,
  paramsFromSearch,
  searchFromParams,
  toResult,
} from './list';

/** Minimaler Ersatz für den PostgREST-Builder: hält nur fest, was aufgerufen wird. */
function fakeQuery() {
  const calls: string[] = [];
  const builder = {
    calls,
    or(filter: string) {
      calls.push(`or(${filter})`);
      return builder;
    },
    in(column: string, values: readonly string[]) {
      calls.push(`in(${column},[${values.join('|')}])`);
      return builder;
    },
    is(column: string, value: null) {
      calls.push(`is(${column},${value})`);
      return builder;
    },
  };
  return builder;
}

describe('escapeLike', () => {
  it('maskiert PostgREST-Sonderzeichen', () => {
    // Ohne Maskierung bricht ein Komma die or()-Bedingung auf
    expect(escapeLike('Müller, GmbH')).toBe('Müller\\, GmbH');
    expect(escapeLike('Meier (Holding)')).toBe('Meier \\(Holding\\)');
    expect(escapeLike('a*b')).toBe('a\\*b');
  });

  it('lässt harmlose Eingaben unverändert', () => {
    expect(escapeLike('Schreinerei Krickl')).toBe('Schreinerei Krickl');
  });

  it('verhindert das Einschleusen zusätzlicher Bedingungen', () => {
    const injected = escapeLike('x,status.eq.won');
    expect(injected).not.toContain(',status.eq.won');
    expect(injected).toBe('x\\,status\\.eq\\.won');
  });
});

describe('applyFilters', () => {
  it('ignoriert leere Filter', () => {
    const q = fakeQuery();
    applyFilters(q, {}, ['status']);
    expect(q.calls).toEqual([]);
  });

  it('baut IN für mehrere Werte', () => {
    const q = fakeQuery();
    applyFilters(q, { status: ['lead', 'customer'] }, ['status']);
    expect(q.calls).toEqual(['in(status,[lead|customer])']);
  });

  it('übersetzt "none" in eine NULL-Prüfung', () => {
    const q = fakeQuery();
    applyFilters(q, { owner_id: ['none'] }, ['owner_id']);
    expect(q.calls).toEqual(['is(owner_id,null)']);
  });

  it('kombiniert "none" mit echten Werten als ODER', () => {
    const q = fakeQuery();
    applyFilters(q, { owner_id: ['abc', 'none'] }, ['owner_id']);
    expect(q.calls).toEqual(['or(owner_id.in.(abc),owner_id.is.null)']);
  });

  it('wendet nur erlaubte Spalten an', () => {
    const q = fakeQuery();
    // Sonst könnte über die URL auf beliebige Spalten gefiltert werden
    applyFilters(q, { geheim: ['x'], status: ['lead'] }, ['status']);
    expect(q.calls).toEqual(['in(status,[lead])']);
  });
});

describe('URL-Zustand', () => {
  it('überträgt Suche, Seite und Filter verlustfrei', () => {
    const original = {
      ...defaultParams('created_at'),
      search: 'Krickl',
      page: 3,
      pageSize: 50,
      sort: 'name',
      asc: true,
      filters: { status: ['lead', 'customer'], owner_id: ['none'] },
    };

    const roundTrip = paramsFromSearch(
      new URLSearchParams(searchFromParams(original, 'created_at')),
      'created_at',
    );

    expect(roundTrip).toEqual(original);
  });

  it('schreibt Standardwerte nicht in die URL', () => {
    const sp = searchFromParams(defaultParams('created_at'), 'created_at');
    expect(sp.toString()).toBe('');
  });

  it('fällt bei unsinnigen Werten auf die Standardwerte zurück', () => {
    const params = paramsFromSearch(
      new URLSearchParams('page=-5&size=9999'),
      'created_at',
    );
    expect(params.page).toBe(1);
    expect(params.pageSize).toBe(DEFAULT_PAGE_SIZE);
  });
});

describe('listKey', () => {
  it('ist unabhängig von der Reihenfolge der Filter', () => {
    const a = { ...defaultParams('created_at'), filters: { status: ['b', 'a'], owner_id: ['x'] } };
    const b = { ...defaultParams('created_at'), filters: { owner_id: ['x'], status: ['a', 'b'] } };
    // Sonst erzeugt dieselbe Ansicht zwei Cache-Einträge
    expect(listKey(a)).toEqual(listKey(b));
  });

  it('unterscheidet verschiedene Filter', () => {
    const a = { ...defaultParams('created_at'), filters: { status: ['lead'] } };
    const b = { ...defaultParams('created_at'), filters: { status: ['customer'] } };
    expect(listKey(a)).not.toEqual(listKey(b));
  });
});

describe('pageRange und toResult', () => {
  it('rechnet Seiten in Bereiche um', () => {
    expect(pageRange({ ...defaultParams('x'), page: 1, pageSize: 25 })).toEqual([0, 24]);
    expect(pageRange({ ...defaultParams('x'), page: 3, pageSize: 25 })).toEqual([50, 74]);
  });

  it('rundet die Seitenzahl auf', () => {
    expect(toResult([], 51, 25).pageCount).toBe(3);
  });

  it('meldet auch ohne Treffer mindestens eine Seite', () => {
    // Sonst zeigt die Paginierung „Seite 1 von 0"
    expect(toResult([], 0, 25).pageCount).toBe(1);
  });
});
