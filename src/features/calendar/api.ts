import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { BookingPage, Database } from '@/integrations/supabase/types';

type Tables = Database['public']['Tables'];
export type Appointment = Tables['appointments']['Row'];
export type AppointmentInsert = Tables['appointments']['Insert'];
export type BookingSetting = Tables['booking_settings']['Row'];

export type AppointmentRow = Appointment & {
  contacts: { id: string; full_name: string } | null;
  companies: { id: string; name: string } | null;
  deals: { id: string; title: string } | null;
  owner: { id: string; full_name: string | null } | null;
};

const SELECT =
  '*, contacts(id, full_name), companies(id, name), deals(id, title), ' +
  'owner:profiles!owner_id(id, full_name)';

/** Termine in einem Zeitfenster — überlappende Termine zählen mit. */
export function useAppointments(from: Date, to: Date, ownerId?: string | null) {
  return useQuery({
    queryKey: ['appointments', from.toISOString(), to.toISOString(), ownerId ?? null],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      let query = supabase
        .from('appointments')
        .select(SELECT)
        // Überlappung statt Enthaltensein: ein Termin, der vor dem Fenster
        // beginnt und hineinragt, gehört in die Ansicht.
        .lt('starts_at', to.toISOString())
        .gt('ends_at', from.toISOString());

      if (ownerId) query = query.eq('owner_id', ownerId);

      const { data, error } = await query.order('starts_at');
      if (error) throw error;
      return (data ?? []) as unknown as AppointmentRow[];
    },
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['appointments'] });
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AppointmentInsert) => {
      const { data, error } = await supabase.from('appointments').insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Tables['appointments']['Update'] & { id: string }) => {
      const { error } = await supabase.from('appointments').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('appointments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

/* ------------------------------------------------------- Buchungsseiten -- */

export function useBookingSettings(ownerId: string | undefined) {
  return useQuery({
    queryKey: ['booking-settings', ownerId],
    enabled: !!ownerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_settings')
        .select('*')
        .eq('owner_id', ownerId!)
        .order('created_at');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpsertBookingSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<BookingSetting> & { owner_id: string; slug: string; title: string }) => {
      const { data, error } = await supabase
        .from('booking_settings')
        .upsert(input as never, { onConflict: 'slug' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['booking-settings'] }),
  });
}

/* ------------------------------------------ Öffentliche Buchungsstrecke -- */

export function usePublicBookingPage(slug: string | undefined) {
  return useQuery({
    queryKey: ['booking-page', slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('booking_page', { p_slug: slug! });
      if (error) throw error;
      return (data as unknown as BookingPage) ?? null;
    },
  });
}

export function useBookingSlots(slug: string | undefined, day: string | undefined) {
  return useQuery({
    queryKey: ['booking-slots', slug, day],
    enabled: !!slug && !!day,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('booking_slots', { p_slug: slug!, p_day: day! });
      if (error) throw error;
      return (data ?? []) as unknown as string[];
    },
  });
}

export function useBookSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      slug: string;
      startsAt: string;
      name: string;
      email: string;
      phone?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase.rpc('book_slot', {
        p_slug: input.slug,
        p_starts_at: input.startsAt,
        p_guest_name: input.name,
        p_guest_email: input.email,
        p_guest_phone: input.phone ?? null,
        p_notes: input.notes ?? null,
      });
      if (error) throw error;
      return data;
    },
    // Nach der Buchung sind die Slots des Tages nicht mehr aktuell
    onSuccess: () => qc.invalidateQueries({ queryKey: ['booking-slots'] }),
  });
}
