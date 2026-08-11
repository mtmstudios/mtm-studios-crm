import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { dateShort, initials } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import type { AppRole, Database } from '@/integrations/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];

/** Alle Profile inklusive deaktivierter — nur Admins sehen diese Seite sinnvoll. */
function useAllProfiles() {
  return useQuery({
    queryKey: ['profiles', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at');
      if (error) throw error;
      return data as Profile[];
    },
  });
}

export default function TeamSettings() {
  const { profile: me, isAdmin } = useAuth();
  const { data: profiles = [], isPending } = useAllProfiles();
  const qc = useQueryClient();

  const patch = useMutation({
    mutationFn: async ({ id, ...changes }: Partial<Profile> & { id: string }) => {
      const { error } = await supabase.from('profiles').update(changes).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles'] });
      qc.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Gespeichert');
    },
    onError: (err) => toast.error((err as Error).message),
  });

  if (isPending) return <Skeleton className="h-48 w-full max-w-3xl" />;

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Mitglieder</h2>
        <p className="text-sm text-muted-foreground">
          Wer sich registriert, wird automatisch Mitglied. Admins verwalten Pipelines und Rollen.
          {!isAdmin && ' Nur Admins können hier etwas ändern.'}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 text-left font-medium">Person</th>
              <th className="px-4 py-2.5 text-left font-medium">Rolle</th>
              <th className="px-4 py-2.5 text-left font-medium">Aktiv</th>
              <th className="hidden px-4 py-2.5 text-left font-medium sm:table-cell">Seit</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => {
              const isSelf = profile.id === me?.id;
              return (
                <tr key={profile.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                        {initials(profile.full_name ?? profile.email)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-medium">
                            {profile.full_name ?? '—'}
                          </span>
                          {isSelf && (
                            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                              Du
                            </Badge>
                          )}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{profile.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Select
                      value={profile.role}
                      // Die eigene Rolle herabzusetzen würde einen aussperren,
                      // wenn man der letzte Admin ist.
                      disabled={!isAdmin || isSelf}
                      onValueChange={(v) => patch.mutate({ id: profile.id, role: v as AppRole })}
                    >
                      <SelectTrigger className="h-8 w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Mitglied</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-2.5">
                    <Switch
                      checked={profile.is_active}
                      disabled={!isAdmin || isSelf}
                      onCheckedChange={(checked) =>
                        patch.mutate({ id: profile.id, is_active: checked })
                      }
                      aria-label="Zugang aktiv"
                    />
                  </td>
                  <td className="hidden px-4 py-2.5 text-muted-foreground sm:table-cell">
                    {dateShort(profile.created_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
