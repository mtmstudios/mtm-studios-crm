import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Fehlt die Konfiguration, soll das sofort und deutlich scheitern. Vorher
// lief die App mit undefined weiter und zeigte nur leere Listen — der
// Fehler war dann nicht mehr von "keine Daten vorhanden" zu unterscheiden.
if (!url || !key) {
  throw new Error(
    'VITE_SUPABASE_URL und VITE_SUPABASE_PUBLISHABLE_KEY fehlen. ' +
      '.env.example nach .env kopieren und ausfüllen.',
  );
}

export const supabase = createClient<Database>(url, key, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
