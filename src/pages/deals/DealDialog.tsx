import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { useProfiles, useStages } from '@/features/meta/api';
import { useCompanyOptions } from '@/features/companies/api';
import { useContactOptions } from '@/features/contacts/api';
import { useCreateDeal, useUpdateDeal, type Deal } from '@/features/deals/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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
import { EntityCombobox } from '@/components/crm/EntityCombobox';

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  deal?: Deal | null;
  defaultPipelineId?: string;
  defaultStageId?: string;
  defaultCompanyId?: string | null;
  defaultContactId?: string | null;
}

export function DealDialog({
  open,
  onOpenChange,
  deal,
  defaultPipelineId,
  defaultStageId,
  defaultCompanyId,
  defaultContactId,
}: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const create = useCreateDeal();
  const update = useUpdateDeal();
  const { data: profiles = [] } = useProfiles();

  const pipelineId = deal?.pipeline_id ?? defaultPipelineId;
  const { data: stages = [] } = useStages(pipelineId);

  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [stageId, setStageId] = useState<string | undefined>();
  const [closeDate, setCloseDate] = useState('');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);

  const [companyTerm, setCompanyTerm] = useState('');
  const [contactTerm, setContactTerm] = useState('');
  const { data: companies = [] } = useCompanyOptions(useDebounce(companyTerm, 250));
  const { data: contacts = [] } = useContactOptions(useDebounce(contactTerm, 250));

  useEffect(() => {
    if (!open) return;
    if (deal) {
      setTitle(deal.title);
      setValue(String(deal.value));
      setStageId(deal.stage_id);
      setCloseDate(deal.expected_close_date ?? '');
      setCompanyId(deal.company_id);
      setContactId(deal.contact_id);
      setOwnerId(deal.owner_id);
    } else {
      setTitle('');
      setValue('');
      setStageId(defaultStageId);
      // Vorschlag: in einem Monat — der häufigste Fall, jederzeit änderbar
      setCloseDate(format(new Date(Date.now() + 30 * 86_400_000), 'yyyy-MM-dd'));
      setCompanyId(defaultCompanyId ?? null);
      setContactId(defaultContactId ?? null);
      setOwnerId(user?.id ?? null);
    }
  }, [open, deal, defaultStageId, defaultCompanyId, defaultContactId, user?.id]);

  // Fällt die vorgegebene Phase weg (andere Pipeline), auf die erste zurück
  useEffect(() => {
    if (stages.length && !stages.some((s) => s.id === stageId)) setStageId(stages[0].id);
  }, [stages, stageId]);

  const busy = create.isPending || update.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Ein Titel wird benötigt.');
      return;
    }
    if (!stageId || !pipelineId) {
      toast.error('Bitte eine Phase wählen.');
      return;
    }

    // Deutsche Eingabe zulassen: "1.500,50" → 1500.50
    const parsed = Number(value.replace(/\./g, '').replace(',', '.')) || 0;

    const payload = {
      title: title.trim(),
      value: parsed,
      stage_id: stageId,
      expected_close_date: closeDate || null,
      company_id: companyId,
      contact_id: contactId,
      owner_id: ownerId,
    };

    try {
      if (deal) {
        await update.mutateAsync({ id: deal.id, ...payload });
        toast.success('Deal gespeichert');
        onOpenChange(false);
      } else {
        const created = await create.mutateAsync({
          ...payload,
          pipeline_id: pipelineId,
          status: 'open',
          created_by: user?.id ?? null,
        });
        toast.success('Deal angelegt');
        onOpenChange(false);
        navigate(`/deals/${created.id}`);
      }
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{deal ? 'Deal bearbeiten' : 'Neuer Deal'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Titel</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              required
              placeholder="z. B. Voice KI Assistent — Musterfirma"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="value">Wert (€)</Label>
              <Input
                id="value"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="close">Erwarteter Abschluss</Label>
              <Input
                id="close"
                type="date"
                value={closeDate}
                onChange={(e) => setCloseDate(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Phase</Label>
            <Select value={stageId} onValueChange={setStageId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Phase wählen" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} · {s.probability} %
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Firma</Label>
            <EntityCombobox
              value={companyId}
              onChange={setCompanyId}
              onSearchChange={setCompanyTerm}
              options={companies.map((c) => ({ value: c.id, label: c.name, hint: c.city }))}
              placeholder="Firma zuordnen …"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Ansprechpartner</Label>
            <EntityCombobox
              value={contactId}
              onChange={setContactId}
              onSearchChange={setContactTerm}
              options={contacts.map((c) => ({ value: c.id, label: c.full_name, hint: c.email }))}
              placeholder="Kontakt zuordnen …"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Inhaber</Label>
            <EntityCombobox
              value={ownerId}
              onChange={setOwnerId}
              options={profiles.map((p) => ({ value: p.id, label: p.full_name ?? p.email }))}
              placeholder="Niemand"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {deal ? 'Speichern' : 'Anlegen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
