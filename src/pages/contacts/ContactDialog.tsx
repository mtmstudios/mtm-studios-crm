import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { useCompanyOptions } from '@/features/companies/api';
import { useProfiles } from '@/features/meta/api';
import { useCreateContact, useUpdateContact, type Contact } from '@/features/contacts/api';
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
import { EntityCombobox } from '@/components/crm/EntityCombobox';
import { CONTACT_STATUS_OPTIONS } from '@/components/crm/primitives';
import type { ContactStatus } from '@/integrations/supabase/types';

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** Gesetzt = Bearbeiten, sonst Neuanlage */
  contact?: Contact | null;
  /** Vorbelegte Firma, wenn aus einer Firmendetailseite angelegt wird */
  defaultCompanyId?: string | null;
}

const EMPTY = {
  first_name: '',
  last_name: '',
  job_title: '',
  email: '',
  phone: '',
  mobile: '',
  status: 'lead' as ContactStatus,
  company_id: null as string | null,
  owner_id: null as string | null,
};

export function ContactDialog({ open, onOpenChange, contact, defaultCompanyId }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const create = useCreateContact();
  const update = useUpdateContact();
  const { data: profiles = [] } = useProfiles();

  const [form, setForm] = useState(EMPTY);
  const [companyTerm, setCompanyTerm] = useState('');
  const debouncedCompany = useDebounce(companyTerm, 250);
  const { data: companies = [] } = useCompanyOptions(debouncedCompany);

  // Beim Öffnen befüllen; beim Schließen nicht zurücksetzen, damit der
  // Dialog beim Ausblenden nicht sichtbar leer wird.
  useEffect(() => {
    if (!open) return;
    if (contact) {
      setForm({
        first_name: contact.first_name ?? '',
        last_name: contact.last_name ?? '',
        job_title: contact.job_title ?? '',
        email: contact.email ?? '',
        phone: contact.phone ?? '',
        mobile: contact.mobile ?? '',
        status: contact.status,
        company_id: contact.company_id,
        owner_id: contact.owner_id,
      });
    } else {
      setForm({ ...EMPTY, company_id: defaultCompanyId ?? null, owner_id: user?.id ?? null });
    }
  }, [open, contact, defaultCompanyId, user?.id]);

  const busy = create.isPending || update.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.first_name.trim() && !form.last_name.trim()) {
      toast.error('Vor- oder Nachname wird benötigt.');
      return;
    }

    // Leere Strings als NULL speichern — sonst greifen Unique-Prüfungen und
    // Filter „nicht gesetzt" nicht.
    const payload = {
      first_name: form.first_name.trim() || null,
      last_name: form.last_name.trim() || null,
      job_title: form.job_title.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      mobile: form.mobile.trim() || null,
      status: form.status,
      company_id: form.company_id,
      owner_id: form.owner_id,
    };

    try {
      if (contact) {
        await update.mutateAsync({ id: contact.id, ...payload });
        toast.success('Kontakt gespeichert');
        onOpenChange(false);
      } else {
        const created = await create.mutateAsync({ ...payload, created_by: user?.id ?? null });
        toast.success('Kontakt angelegt');
        onOpenChange(false);
        navigate(`/kontakte/${created.id}`);
      }
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{contact ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}</DialogTitle>
          <DialogDescription>
            Pflichtangabe ist nur der Name. Alles Weitere lässt sich später ergänzen.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="first_name">Vorname</Label>
              <Input
                id="first_name"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_name">Nachname</Label>
              <Input
                id="last_name"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Firma</Label>
            <EntityCombobox
              value={form.company_id}
              onChange={(company_id) => setForm({ ...form, company_id })}
              onSearchChange={setCompanyTerm}
              options={companies.map((c) => ({ value: c.id, label: c.name, hint: c.city }))}
              placeholder="Firma zuordnen …"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="job_title">Position</Label>
            <Input
              id="job_title"
              value={form.job_title}
              onChange={(e) => setForm({ ...form, job_title: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mobile">Mobil</Label>
              <Input
                id="mobile"
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as ContactStatus })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Inhaber</Label>
              <EntityCombobox
                value={form.owner_id}
                onChange={(owner_id) => setForm({ ...form, owner_id })}
                options={profiles.map((p) => ({ value: p.id, label: p.full_name ?? p.email }))}
                placeholder="Niemand"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {contact ? 'Speichern' : 'Anlegen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
