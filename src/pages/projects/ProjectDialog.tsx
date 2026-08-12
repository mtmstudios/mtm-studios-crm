import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { useCompanyOptions } from '@/features/companies/api';
import { useProfiles } from '@/features/meta/api';
import { STATUS_OPTIONEN, useCreateProject, useUpdateProject, type Project } from '@/features/projects/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EntityCombobox } from '@/components/crm/EntityCombobox';
import type { ProjectStatus } from '@/integrations/supabase/types';

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  project?: Project | null;
  defaultCompanyId?: string | null;
}

export function ProjectDialog({ open, onOpenChange, project, defaultCompanyId }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const create = useCreateProject();
  const update = useUpdateProject();
  const { data: profiles = [] } = useProfiles();

  const [name, setName] = useState('');
  const [beschreibung, setBeschreibung] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('planung');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [start, setStart] = useState('');
  const [faellig, setFaellig] = useState('');

  const [firmaSuche, setFirmaSuche] = useState('');
  const { data: firmen = [] } = useCompanyOptions(useDebounce(firmaSuche, 250));

  useEffect(() => {
    if (!open) return;
    if (project) {
      setName(project.name);
      setBeschreibung(project.description ?? '');
      setStatus(project.status);
      setCompanyId(project.company_id);
      setOwnerId(project.owner_id);
      setStart(project.starts_on ?? '');
      setFaellig(project.due_on ?? '');
    } else {
      setName('');
      setBeschreibung('');
      setStatus('planung');
      setCompanyId(defaultCompanyId ?? null);
      setOwnerId(user?.id ?? null);
      setStart('');
      setFaellig('');
    }
  }, [open, project, defaultCompanyId, user?.id]);

  const busy = create.isPending || update.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Ein Projektname wird benötigt.');
      return;
    }
    if (start && faellig && faellig < start) {
      toast.error('Das Enddatum liegt vor dem Start.');
      return;
    }

    const payload = {
      name: name.trim(),
      description: beschreibung.trim() || null,
      status,
      company_id: companyId,
      owner_id: ownerId,
      starts_on: start || null,
      due_on: faellig || null,
      // Die Datenbank verlangt Zeitstempel und Status im Gleichklang
      completed_at: status === 'abgeschlossen' ? (project?.completed_at ?? new Date().toISOString()) : null,
    };

    try {
      if (project) {
        await update.mutateAsync({ id: project.id, ...payload });
        toast.success('Projekt gespeichert');
        onOpenChange(false);
      } else {
        const neu = await create.mutateAsync({ ...payload, created_by: user?.id ?? null });
        toast.success('Projekt angelegt');
        onOpenChange(false);
        navigate(`/projekte/${neu.id}`);
      }
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{project ? 'Projekt bearbeiten' : 'Neues Projekt'}</DialogTitle>
          <DialogDescription>
            Abschnitte für das Board werden automatisch angelegt und lassen sich danach ändern.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pname">Name</Label>
            <Input
              id="pname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
              placeholder="z. B. Voice KI Rollout — Smart Dental"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Kunde</Label>
            <EntityCombobox
              value={companyId}
              onChange={setCompanyId}
              onSearchChange={setFirmaSuche}
              options={firmen.map((f) => ({ value: f.id, label: f.name, hint: f.city }))}
              placeholder="Firma zuordnen …"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pstart">Start</Label>
              <Input
                id="pstart"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pende">Fällig</Label>
              <Input
                id="pende"
                type="date"
                value={faellig}
                onChange={(e) => setFaellig(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONEN.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Verantwortlich</Label>
              <EntityCombobox
                value={ownerId}
                onChange={setOwnerId}
                options={profiles.map((p) => ({ value: p.id, label: p.full_name ?? p.email }))}
                placeholder="Niemand"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pbeschreibung">Beschreibung</Label>
            <Textarea
              id="pbeschreibung"
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              rows={3}
              className="resize-none"
              placeholder="Was ist der Auftrag, was ist das Ziel?"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {project ? 'Speichern' : 'Anlegen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
