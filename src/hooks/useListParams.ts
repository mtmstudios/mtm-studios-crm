import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { paramsFromSearch, searchFromParams, type ListParams } from '@/lib/list';

/**
 * Hält den Listenzustand in der URL statt im Komponenten-State. Dadurch sind
 * gefilterte Ansichten teilbar, der Zurück-Button funktioniert, und ein
 * Reload verliert die Auswahl nicht.
 */
export function useListParams(defaultSort: string, defaultAsc = false) {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo(
    () => paramsFromSearch(searchParams, defaultSort, defaultAsc),
    [searchParams, defaultSort, defaultAsc],
  );

  const commit = useCallback(
    (next: ListParams) => {
      const sp = searchFromParams(next, defaultSort, defaultAsc);
      // Fremde Parameter (z. B. ?neu=1) nicht wegwerfen
      searchParams.forEach((value, key) => {
        if (!key.startsWith('f_') && !['q', 'page', 'size', 'sort', 'asc'].includes(key)) {
          sp.set(key, value);
        }
      });
      setSearchParams(sp, { replace: true });
    },
    [defaultSort, defaultAsc, searchParams, setSearchParams],
  );

  const setSearch = useCallback(
    // Jede neue Sucheingabe beginnt wieder auf Seite 1 — sonst landet man
    // auf einer Seite, die es im neuen Ergebnis nicht mehr gibt.
    (search: string) => commit({ ...params, search, page: 1 }),
    [commit, params],
  );

  const setPage = useCallback((page: number) => commit({ ...params, page }), [commit, params]);

  const setPageSize = useCallback(
    (pageSize: number) => commit({ ...params, pageSize, page: 1 }),
    [commit, params],
  );

  const toggleSort = useCallback(
    (column: string) =>
      commit({
        ...params,
        sort: column,
        // Gleiche Spalte kehrt die Richtung um, neue Spalte startet absteigend
        asc: params.sort === column ? !params.asc : false,
        page: 1,
      }),
    [commit, params],
  );

  const setFilter = useCallback(
    (column: string, values: string[]) => {
      const filters = { ...params.filters };
      if (values.length) filters[column] = values;
      else delete filters[column];
      commit({ ...params, filters, page: 1 });
    },
    [commit, params],
  );

  const clearFilters = useCallback(
    () => commit({ ...params, filters: {}, search: '', page: 1 }),
    [commit, params],
  );

  const activeFilterCount = useMemo(
    () => Object.values(params.filters).filter((v) => v.length).length,
    [params.filters],
  );

  return {
    params,
    setSearch,
    setPage,
    setPageSize,
    toggleSort,
    setFilter,
    clearFilters,
    activeFilterCount,
  };
}
