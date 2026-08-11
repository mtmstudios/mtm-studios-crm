import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, ArchiveRestore, ArrowLeft, Inbox as InboxIcon, Send } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { dateRelative, initials, time } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import {
  useArchiveConversation,
  useConversations,
  useMarkRead,
  useMessages,
  useSendMessage,
} from '@/features/inbox/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState, PageHeader } from '@/components/crm/primitives';

const CHANNEL_LABEL = { email: 'E-Mail', sms: 'SMS', whatsapp: 'WhatsApp' } as const;

export default function Inbox() {
  const { user } = useAuth();
  const [term, setTerm] = useState('');
  const search = useDebounce(term, 300);
  const [archived, setArchived] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const { data: conversations = [], isPending } = useConversations(search, archived);
  const { data: messages = [] } = useMessages(activeId ?? undefined);
  const markRead = useMarkRead();
  const archive = useArchiveConversation();
  const send = useSendMessage();

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const bottomRef = useRef<HTMLDivElement>(null);

  // Beim Öffnen als gelesen markieren
  useEffect(() => {
    if (active && active.unread_count > 0) markRead.mutate(active.id);
    // markRead ist bei jedem Render neu und gehört nicht in die Abhängigkeiten
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, active?.unread_count]);

  // Neue Nachrichten in den sichtbaren Bereich holen
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, activeId]);

  const submit = async () => {
    const body = draft.trim();
    if (!body || !active) return;
    try {
      await send.mutateAsync({
        conversationId: active.id,
        body,
        toAddr: active.counterparty,
        createdBy: user?.id ?? null,
      });
      setDraft('');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <>
      <PageHeader title="Posteingang" subtitle={`${conversations.length} Unterhaltungen`} />

      <div className="grid h-[calc(100vh-8.5rem)] grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)]">
        {/* Liste */}
        <div
          className={cn(
            'flex min-h-0 flex-col border-r border-border',
            // Auf schmalen Schirmen wird zwischen Liste und Verlauf gewechselt
            activeId && 'hidden md:flex',
          )}
        >
          <div className="space-y-2 border-b border-border p-3">
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Suchen …"
              className="h-9"
            />
            <Tabs
              value={archived ? 'archiv' : 'aktiv'}
              onValueChange={(v) => setArchived(v === 'archiv')}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="aktiv">Aktiv</TabsTrigger>
                <TabsTrigger value="archiv">Archiv</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto">
            {isPending && (
              <div className="space-y-2 p-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            )}

            {!isPending && conversations.length === 0 && (
              <div className="py-12">
                <EmptyState
                  icon={InboxIcon}
                  title={archived ? 'Archiv ist leer' : 'Keine Unterhaltungen'}
                  description="Eingehende Nachrichten erscheinen hier, sobald ein Kanal angebunden ist."
                />
              </div>
            )}

            <ul>
              {conversations.map((conversation) => (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(conversation.id)}
                    className={cn(
                      'flex w-full gap-2.5 border-b border-border px-3 py-2.5 text-left transition-colors hover:bg-surface-hover',
                      activeId === conversation.id && 'bg-primary/5',
                    )}
                  >
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                      {initials(conversation.contacts?.full_name ?? conversation.counterparty)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span
                          className={cn(
                            'truncate text-sm',
                            conversation.unread_count > 0 ? 'font-semibold' : 'font-medium',
                          )}
                        >
                          {conversation.contacts?.full_name ?? conversation.counterparty}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {dateRelative(conversation.last_message_at)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        <span className="truncate text-xs text-muted-foreground">
                          {conversation.subject ?? CHANNEL_LABEL[conversation.channel]}
                        </span>
                        {conversation.unread_count > 0 && (
                          <span className="ml-auto grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                            {conversation.unread_count}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Verlauf */}
        <div className={cn('flex min-h-0 flex-col', !activeId && 'hidden md:flex')}>
          {!active ? (
            <div className="grid flex-1 place-items-center">
              <EmptyState
                icon={InboxIcon}
                title="Keine Unterhaltung gewählt"
                description="Links eine Unterhaltung auswählen."
              />
            </div>
          ) : (
            <>
              <header className="flex items-center gap-2 border-b border-border px-4 py-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setActiveId(null)}
                  aria-label="Zurück zur Liste"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {active.contacts ? (
                      <Link
                        to={`/kontakte/${active.contacts.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {active.contacts.full_name}
                      </Link>
                    ) : (
                      active.counterparty
                    )}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {CHANNEL_LABEL[active.channel]} · {active.counterparty}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    archive.mutate(
                      { id: active.id, archived: !active.is_archived },
                      { onSuccess: () => setActiveId(null) },
                    )
                  }
                >
                  {active.is_archived ? (
                    <>
                      <ArchiveRestore className="mr-1.5 h-4 w-4" />
                      Zurückholen
                    </>
                  ) : (
                    <>
                      <Archive className="mr-1.5 h-4 w-4" />
                      Archivieren
                    </>
                  )}
                </Button>
              </header>

              <div className="scrollbar-slim min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-surface p-4">
                {messages.map((message) => {
                  const outbound = message.direction === 'outbound';
                  return (
                    <div
                      key={message.id}
                      className={cn('flex', outbound ? 'justify-end' : 'justify-start')}
                    >
                      <div
                        className={cn(
                          'max-w-[75%] rounded-lg px-3 py-2 text-sm',
                          outbound
                            ? 'bg-primary text-primary-foreground'
                            : 'border border-border bg-card',
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{message.body}</p>
                        <div
                          className={cn(
                            'mt-1 text-[10px]',
                            outbound ? 'text-primary-foreground/70' : 'text-muted-foreground',
                          )}
                        >
                          {time(message.sent_at)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-border p-3">
                <div className="flex items-end gap-2">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Antwort schreiben …"
                    rows={2}
                    className="min-h-0 resize-none"
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void submit();
                    }}
                  />
                  <Button
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={submit}
                    disabled={!draft.trim() || send.isPending}
                    aria-label="Senden"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Wird im Verlauf festgehalten. Der tatsächliche Versand läuft über den
                  angebundenen Kanal.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
