import { useRef, useState } from 'react';
import {
  Download,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  File as FileIcon,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { dateShort } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import {
  dokumentUrl,
  groesse,
  useDeleteDocument,
  useDocuments,
  useUploadDocument,
  type Document,
  type DocumentParent,
} from '@/features/documents/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/crm/ConfirmDialog';

function symbol(mime: string | null) {
  const m = mime ?? '';
  if (m.startsWith('image/')) return FileImage;
  if (m.includes('pdf')) return FileText;
  if (m.includes('sheet') || m.includes('excel') || m.includes('csv')) return FileSpreadsheet;
  if (m.includes('zip') || m.includes('rar') || m.includes('compressed')) return FileArchive;
  return FileIcon;
}

export function DocumentPanel({ parent, titel = 'Dokumente' }: { parent: DocumentParent; titel?: string }) {
  const { user } = useAuth();
  const { data: dokumente = [], isPending, error } = useDocuments(parent);
  const upload = useUploadDocument(parent);
  const remove = useDeleteDocument(parent);

  const eingabe = useRef<HTMLInputElement>(null);
  const [ueberZone, setUeberZone] = useState(false);
  const [zuLoeschen, setZuLoeschen] = useState<Document | null>(null);

  const hochladen = async (dateien: FileList | null) => {
    if (!dateien?.length) return;
    // Mehrfachauswahl nacheinander, damit eine kaputte Datei die anderen
    // nicht mitreißt.
    for (const file of Array.from(dateien)) {
      try {
        await upload.mutateAsync({ file, uploadedBy: user?.id ?? null });
      } catch (err) {
        toast.error(`${file.name}: ${(err as Error).message}`);
      }
    }
    if (eingabe.current) eingabe.current.value = '';
  };

  const oeffnen = async (dok: Document) => {
    try {
      const url = await dokumentUrl(dok);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">
          {titel}
          {dokumente.length > 0 && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">{dokumente.length}</span>
          )}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => eingabe.current?.click()}
          disabled={upload.isPending}
        >
          {upload.isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-1.5 h-4 w-4" />
          )}
          Hochladen
        </Button>
        <input
          ref={eingabe}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => void hochladen(e.target.files)}
        />
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setUeberZone(true);
        }}
        onDragLeave={() => setUeberZone(false)}
        onDrop={(e) => {
          e.preventDefault();
          setUeberZone(false);
          void hochladen(e.dataTransfer.files);
        }}
        className={cn('transition-colors', ueberZone && 'bg-primary/5 ring-2 ring-inset ring-primary/30')}
      >
        {error && (
          <p className="px-4 py-6 text-center text-sm text-destructive">
            Dokumente konnten nicht geladen werden: {(error as Error).message}
          </p>
        )}

        {isPending && !error && (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {!isPending && !error && dokumente.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Noch keine Dateien. Ziehe PDFs, Bilder oder Tabellen hierher.
          </p>
        )}

        <ul className="divide-y divide-border">
          {dokumente.map((dok) => {
            const Symbol = symbol(dok.mime_type);
            return (
              <li key={dok.id} className="group flex items-center gap-3 px-4 py-2.5">
                <Symbol className="h-4 w-4 shrink-0 text-muted-foreground" />
                <button
                  type="button"
                  onClick={() => oeffnen(dok)}
                  className="min-w-0 flex-1 text-left"
                  title={dok.name}
                >
                  <span className="block truncate text-sm font-medium hover:text-primary hover:underline">
                    {dok.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {groesse(dok.size_bytes)} · {dateShort(dok.created_at)}
                    {dok.uploader?.full_name ? ` · ${dok.uploader.full_name}` : ''}
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-1 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => oeffnen(dok)}
                    aria-label={`${dok.name} öffnen`}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setZuLoeschen(dok)}
                    aria-label={`${dok.name} löschen`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <ConfirmDialog
        open={!!zuLoeschen}
        onOpenChange={(offen) => !offen && setZuLoeschen(null)}
        title={`„${zuLoeschen?.name}" löschen?`}
        description="Die Datei wird endgültig aus dem Speicher entfernt."
        confirmLabel="Löschen"
        destructive
        onConfirm={async () => {
          if (!zuLoeschen) return;
          await remove.mutateAsync(zuLoeschen);
          toast.success('Datei gelöscht');
          setZuLoeschen(null);
        }}
      />
    </section>
  );
}
