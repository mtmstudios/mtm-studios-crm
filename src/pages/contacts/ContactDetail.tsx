import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Mail, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { dateLong, dateShort, displayName, money } from '@/lib/format';
import { useContact, useDeleteContacts } from '@/features/contacts/api';
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
import { ContactDialog } from './ContactDialog';

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: contact, isPending } = useContact(id);
  const { data: deals = [] } = useRelatedDeals('contact_id', id);
  const { data: timeline = [], isPending: timelinePending } = useTimeline('contact_id', id);
  const remove = useDeleteContacts();

  const [editOpen, setEditOpen] = useState(false);
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

  if (!contact) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Dieser Kontakt existiert nicht (mehr).</p>
        <Button variant="link" className="px-0" onClick={() => navigate('/kontakte')}>
          Zurück zur Übersicht
        </Button>
      </div>
    );
  }

  const name = displayName(contact);

  const doDelete = async () => {
    await remove.mutateAsync([contact.id]);
    toast.success('Kontakt gelöscht');
    navigate('/kontakte');
  };

  return (
    <>
      <div className="border-b border-border px-4 py-4 sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-2 h-7 text-muted-foreground"
          onClick={() => navigate('/kontakte')}
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          Kontakte
        </Button>

        <div className="flex flex-wrap items-start gap-4">
          <EntityAvatar name={name} seed={contact.id} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold tracking-tight">{name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {contact.job_title && <span>{contact.job_title}</span>}
              {contact.companies && (
                <Link
                  to={`/firmen/${contact.companies.id}`}
                  className="inline-flex items-center gap-1 hover:text-primary hover:underline"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  {contact.companies.name}
                </Link>
              )}
              <StatusBadge kind="contact" value={contact.status} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {contact.email && (
              <Button variant="outline" size="sm" asChild>
                <a href={`mailto:${contact.email}`}>
                  <Mail className="mr-1.5 h-4 w-4" />
                  E-Mail
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Bearbeiten
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
              aria-label="Kontakt löschen"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Stammdaten */}
        <aside className="space-y-6">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold">Details</h2>
            <dl>
              <PropertyRow label="E-Mail">
                {contact.email ? (
                  <a href={`mailto:${contact.email}`} className="hover:text-primary hover:underline">
                    {contact.email}
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </PropertyRow>
              <PropertyRow label="Telefon">
                {contact.phone ? (
                  <a href={`tel:${contact.phone}`} className="hover:text-primary hover:underline">
                    {contact.phone}
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </PropertyRow>
              <PropertyRow label="Mobil">
                {contact.mobile ? (
                  <a href={`tel:${contact.mobile}`} className="hover:text-primary hover:underline">
                    {contact.mobile}
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </PropertyRow>
              <PropertyRow label="Anschrift">
                {contact.street || contact.city ? (
                  <span>
                    {contact.street}
                    {contact.street && <br />}
                    {[contact.zip, contact.city].filter(Boolean).join(' ')}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </PropertyRow>
              <PropertyRow label="Geburtstag">
                {contact.birthday ? dateLong(contact.birthday) : <span className="text-muted-foreground">—</span>}
              </PropertyRow>
              <PropertyRow label="Inhaber">
                {contact.owner?.full_name ?? <span className="text-muted-foreground">—</span>}
              </PropertyRow>
              <PropertyRow label="Angelegt">{dateShort(contact.created_at)}</PropertyRow>
            </dl>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold">Tags</h2>
            <TagPicker entity="contact" entityId={contact.id} />
          </section>

          <DocumentPanel parent={{ contact_id: contact.id }} />

          <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Deals</h2>
              <span className="text-xs text-muted-foreground">{deals.length}</span>
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

        {/* Verlauf */}
        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Verlauf</h2>
            <Button variant="outline" size="sm" onClick={() => setActivityOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Aufgabe
            </Button>
          </div>
          <Timeline items={timeline} loading={timelinePending} parent={{ contact_id: contact.id }} />
        </section>
      </div>

      <ContactDialog open={editOpen} onOpenChange={setEditOpen} contact={contact} />
      <ActivityDialog
        open={activityOpen}
        onOpenChange={setActivityOpen}
        parent={{ contact_id: contact.id }}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`${name} löschen?`}
        description="Aufgaben und Notizen dieses Kontakts werden mitgelöscht."
        confirmLabel="Löschen"
        destructive
        onConfirm={doDelete}
      />
    </>
  );
}
