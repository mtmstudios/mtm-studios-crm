import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Tables = Database['public']['Tables'];
export type Document = Tables['documents']['Row'];

export type DocumentRow = Document & {
  uploader: { full_name: string | null } | null;
};

/** An welchem Datensatz die Datei hängt. */
export type DocumentParent =
  | { company_id: string }
  | { contact_id: string }
  | { deal_id: string }
  | { project_id: string };

const BUCKET = 'dokumente';

/** 25 MB — dieselbe Grenze wie im Bucket, damit der Fehler früh kommt. */
export const MAX_BYTES = 25 * 1024 * 1024;

function parentSpalte(parent: DocumentParent): keyof Document {
  return Object.keys(parent)[0] as keyof Document;
}

export function useDocuments(parent: DocumentParent | null) {
  const spalte = parent ? parentSpalte(parent) : null;
  const wert = parent ? Object.values(parent)[0] : null;

  return useQuery({
    queryKey: ['documents', spalte, wert],
    enabled: !!parent,
    queryFn: async () => {
      // Die Spalte kommt zur Laufzeit; als generischer Parameter treibt sie
      // den Typechecker in „excessively deep instantiation". Deshalb hier
      // einmal bewusst entkoppelt statt eq() zu parametrisieren.
      const query = supabase
        .from('documents')
        .select('*, uploader:profiles!uploaded_by(full_name)') as unknown as {
        eq(spalte: string, wert: string): {
          order(
            spalte: string,
            opts: { ascending: boolean },
          ): Promise<{ data: DocumentRow[] | null; error: Error | null }>;
        };
      };

      const { data, error } = await query
        .eq(spalte as string, wert as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Dateinamen für den Storage entschärfen. Umlaute und Leerzeichen führen
 * dort sonst zu Pfaden, die sich später schlecht wieder ansprechen lassen.
 * Der ursprüngliche Name bleibt in der Tabelle erhalten.
 */
function pfadName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(-120);
}

export function useUploadDocument(parent: DocumentParent) {
  const qc = useQueryClient();
  const spalte = parentSpalte(parent);
  const wert = Object.values(parent)[0];

  return useMutation({
    mutationFn: async ({ file, uploadedBy }: { file: File; uploadedBy: string | null }) => {
      if (file.size > MAX_BYTES) {
        throw new Error(`Die Datei ist größer als 25 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).`);
      }

      // Zufälliges Präfix: gleiche Dateinamen am selben Datensatz sollen sich
      // nicht gegenseitig überschreiben.
      const pfad = `${spalte}/${wert}/${crypto.randomUUID()}-${pfadName(file.name)}`;

      const { error: uploadFehler } = await supabase.storage
        .from(BUCKET)
        .upload(pfad, file, { contentType: file.type || undefined, upsert: false });
      if (uploadFehler) throw uploadFehler;

      const { data, error } = await supabase
        .from('documents')
        .insert({
          name: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
          storage_path: pfad,
          uploaded_by: uploadedBy,
          ...parent,
        })
        .select()
        .single();

      if (error) {
        // Metadaten fehlgeschlagen → die Datei nicht verwaist zurücklassen
        await supabase.storage.from(BUCKET).remove([pfad]);
        throw error;
      }
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents', spalte, wert] }),
  });
}

export function useDeleteDocument(parent: DocumentParent) {
  const qc = useQueryClient();
  const spalte = parentSpalte(parent);
  const wert = Object.values(parent)[0];

  return useMutation({
    mutationFn: async (dok: Document) => {
      // Erst die Datei, dann die Zeile. Andersherum bliebe bei einem Fehler
      // eine Datei ohne Eintrag im Bucket liegen.
      const { error: storageFehler } = await supabase.storage.from(BUCKET).remove([dok.storage_path]);
      if (storageFehler) throw storageFehler;

      const { error } = await supabase.from('documents').delete().eq('id', dok.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents', spalte, wert] }),
  });
}

/**
 * Signierte URL erzeugen. Der Bucket ist privat; ohne Signatur kommt niemand
 * an die Datei, auch nicht mit dem Anon-Key.
 */
export async function dokumentUrl(dok: Document, sekunden = 60): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(dok.storage_path, sekunden);
  if (error) throw error;
  return data.signedUrl;
}

/** Dateigröße lesbar machen. */
export function groesse(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
