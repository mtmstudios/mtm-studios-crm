import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfiles } from '@/features/meta/api';
import { useCreateCompany, useUpdateCompany, type Company } from '@/features/companies/api';
import { toDomain } from '@/lib/format';
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
import { COMPANY_STATUS_OPTIONS } from '@/components/crm/primitives';
import type { CompanyStatus } from '@/integrations/supabase/types';

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  company?: Company | null;
}

const EMPTY = {
  name: '',
  website: '',
  industry: '',
  phone: '',
  email: '',
  street: '',
  zip: '',
  city: '',
  status: 'lead' as CompanyStatus,
  owner_id: null as string | null,
};

export function CompanyDialog({ open, onOpenChange, company }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const create = useCreateCompany();
  const update = useUpdateCompany();
  const { data: profiles = [] } = useProfiles();
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!open) return;
    if (company) {
      setForm({
        name: company.name,
        website: company.website ?? '',
        industry: company.industry ?? '',
        phone: company.phone ?? '',
        email: company.email ?? '',
        street: company.street ?? '',
        zip: company.zip ?? '',
        city: company.city ?? '',
        status: company.status,
        owner_id: company.owner_id,
      });
    } else {
      setForm({ ...EMPTY, owner_id: user?.id ?? null });
    }
  }, [open, company, user?.id]);

  const busy = create.isPending || update.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Der Firmenname wird benötigt.');
      return;
    }

    const website = form.website.trim();
    const payload = {
      name: form.name.trim(),
      website: website || null,
      // Domain aus der Website ableiten — sie ist der stabilere Schlüssel
      // für Abgleiche und Dubletten-Erkennung.
      domain: toDomain(website),
      industry: form.industry.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      street: form.street.trim() || null,
      zip: form.zip.trim() || null,
      city: form.city.trim() || null,
      status: form.status,
      owner_id: form.owner_id,
    };

    try {
      if (company) {
        await update.mutateAsync({ id: company.id, ...payload });
        toast.success('Firma gespeichert');
        onOpenChange(false);
      } else {
        const created = await create.mutateAsync({ ...payload, created_by: user?.id ?? null });
        toast.success('Firma angelegt');
        onOpenChange(false);
        navigate(`/firmen/${created.id}`);
      }
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{company ? 'Firma bearbeiten' : 'Neue Firma'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="beispiel.de"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="industry">Branche</Label>
              <Input
                id="industry"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
              />
            </div>
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
              <Label htmlFor="cemail">E-Mail</Label>
              <Input
                id="cemail"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="street">Straße</Label>
            <Input
              id="street"
              value={form.street}
              onChange={(e) => setForm({ ...form, street: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-[100px_1fr] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="zip">PLZ</Label>
              <Input
                id="zip"
                value={form.zip}
                onChange={(e) => setForm({ ...form, zip: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">Ort</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as CompanyStatus })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_STATUS_OPTIONS.map((o) => (
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
              {company ? 'Speichern' : 'Anlegen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
