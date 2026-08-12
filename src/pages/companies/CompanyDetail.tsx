import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Globe, Pencil, Plus, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { dateShort, displayName, money, toDomain } from '@/lib/format';
import { useCompany, useCompanyContacts, useDeleteCompanies } from '@/features/companies/api';
import { useRelatedDeals } from '@/features/deals/api';
import { useTimeline } from '@/features/activities/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Timeline } from '@/components/crm/Timeline';
import { ActivityDialog } from '@/components/crm/ActivityDialog';
import { ConfirmDialog } from '@/components/crm/ConfirmDialog';
import { EntityAvatar, PropertyRow, StatusBadge } from '@/components/crm/primitives';
import { TagPicker } from '@/components/crm/TagPicker';
import { DocumentPanel } from '@/components/crm/DocumentPanel';
import { ContactDialog } from '@/pages/contacts/ContactDialog';
import { CompanyDialog } from './CompanyDialog';

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: company, isPending } = useCompany(id);
  const { data: contacts = [] } = useCompanyContacts(id);
  const { data: deals = [] } = useRelatedDeals('company_id', id);
  const { data: timeline = [], isPending: timelinePending } = useTimeline('company_id', id);
  const remove = useDeleteCompanies();

  const [editOpen, setEditOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isPending) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Diese Firma existiert nicht (mehr).</p>
        <Button variant="link" className="px-0" onClick={() => navigate('/firmen')}>
          Zurück zur Übersicht
        </Button>
      </div>
    );
  }

  const domain = toDomain(company.website ?? company.domain);
  const openValue = deals.filter((d) => d.status === 'open').reduce((sum, d) => sum + Number(d.value), 0);

  const doDelete = async () => {
    await remove.mutateAsync([company.id]);
    toast.success('Firma gelöscht');
    navigate('/firmen');
  };

  return (
    <>
      <div className="border-b border-border px-4 py-4 sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-2 h-7 text-muted-foreground"
          onClick={() => navigate('/firmen')}
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          Firmen
        </Button>

        <div className="flex flex-wrap items-start gap-4">
          <EntityAvatar name={company.name} seed={company.id} size="lg" square />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold tracking-tight">{company.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {company.industry && <span>{company.industry}</span>}
              {company.city && <span>{company.city}</span>}
              {domain && (
                <a
                  href={company.website ?? `https://${domain}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 hover:text-primary hover:underline"
                >
                  <Globe className="h-3.5 w-3.5" />
                  {domain}
                </a>
              )}
              <StatusBadge kind="company" value={company.status} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Bearbeiten
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
              aria-label="Firma löschen"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold">Details</h2>
            <dl>
              <PropertyRow label="Telefon">
                {company.phone ? (
                  <a href={`tel:${company.phone}`} className="hover:text-primary hover:underline">
                    {company.phone}
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </PropertyRow>
              <PropertyRow label="E-Mail">
                {company.email ? (
                  <a href={`mailto:${company.email}`} className="hover:text-primary hover:underline">
                    {company.email}
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </PropertyRow>
              <PropertyRow label="Anschrift">
                {company.street || company.city ? (
                  <span>
                    {company.street}
                    {company.street && <br />}
                    {[company.zip, company.city].filter(Boolean).join(' ')}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </PropertyRow>
              <PropertyRow label="USt-IdNr.">
                {company.vat_number ?? <span className="text-muted-foreground">—</span>}
              </PropertyRow>
              <PropertyRow label="Kundennr.">
                {company.customer_number ?? <span className="text-muted-foreground">—</span>}
              </PropertyRow>
              <PropertyRow label="Inhaber">
                {company.owner?.full_name ?? <span className="text-muted-foreground">—</span>}
              </PropertyRow>
              <PropertyRow label="Angelegt">{dateShort(company.created_at)}</PropertyRow>
            </dl>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold">Tags</h2>
            <TagPicker entity="company" entityId={company.id} />
          </section>

          <DocumentPanel parent={{ company_id: company.id }} />

          <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Deals</h2>
              <span className="text-xs text-muted-foreground">{money(openValue)} offen</span>
            </div>
            {deals.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Deals verknüpft.</p>
            ) : (
              <ul className="space-y-1.5">
                {deals.map((deal) => (
                  <li key={deal.id}>
                    <Link
                      to={`/deals/${deal.id}`}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-hover"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{deal.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {deal.stages?.name}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums">{money(deal.value)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        <section className="min-w-0 space-y-6">
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Kontakte ({contacts.length})</h2>
              <Button variant="outline" size="sm" onClick={() => setContactOpen(true)}>
                <UserPlus className="mr-1.5 h-4 w-4" />
                Kontakt
              </Button>
            </div>
            {contacts.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Noch keine Ansprechpartner hinterlegt.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {contacts.map((contact) => (
                  <li key={contact.id}>
                    <Link
                      to={`/kontakte/${contact.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover"
                    >
                      <EntityAvatar name={displayName(contact)} seed={contact.id} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {displayName(contact)}
                        </span>
                        {contact.job_title && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {contact.job_title}
                          </span>
                        )}
                      </span>
                      <span className="hidden truncate text-sm text-muted-foreground sm:block">
                        {contact.email}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Verlauf</h2>
              <Button variant="outline" size="sm" onClick={() => setActivityOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                Aufgabe
              </Button>
            </div>
            <Timeline
              items={timeline}
              loading={timelinePending}
              parent={{ company_id: company.id }}
            />
          </div>
        </section>
      </div>

      <CompanyDialog open={editOpen} onOpenChange={setEditOpen} company={company} />
      <ContactDialog
        open={contactOpen}
        onOpenChange={setContactOpen}
        defaultCompanyId={company.id}
      />
      <ActivityDialog
        open={activityOpen}
        onOpenChange={setActivityOpen}
        parent={{ company_id: company.id }}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`${company.name} löschen?`}
        description="Kontakte bleiben erhalten, verlieren aber ihre Firmenzuordnung."
        confirmLabel="Löschen"
        destructive
        onConfirm={doDelete}
      />
    </>
  );
}
