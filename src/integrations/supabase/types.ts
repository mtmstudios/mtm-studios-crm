/**
 * Datenbanktypen, passend zu supabase/migrations/*.sql.
 *
 * Bei Schemaänderungen neu erzeugen mit:
 *   npx supabase gen types typescript --project-id <ref> > src/integrations/supabase/types.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = 'admin' | 'member';
export type EntityType = 'contact' | 'company' | 'deal';
export type CompanyStatus = 'lead' | 'prospect' | 'customer' | 'partner' | 'inactive';
export type ContactStatus = 'lead' | 'active' | 'inactive';
export type DealStatus = 'open' | 'won' | 'lost';
export type ActivityType = 'call' | 'meeting' | 'task' | 'email' | 'deadline' | 'lunch';
export type ChannelType = 'email' | 'sms' | 'whatsapp';
export type DirectionType = 'inbound' | 'outbound';
export type FieldType =
  | 'text' | 'textarea' | 'number' | 'currency' | 'date'
  | 'select' | 'multiselect' | 'checkbox' | 'url' | 'email' | 'phone';
export type ApptStatus = 'scheduled' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
export type ProjectStatus = 'planung' | 'laeuft' | 'pausiert' | 'abgeschlossen' | 'abgebrochen';

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: AppRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type Company = {
  id: string;
  name: string;
  legal_name: string | null;
  domain: string | null;
  website: string | null;
  industry: string | null;
  employee_count: number | null;
  annual_revenue: number | null;
  phone: string | null;
  email: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  country: string | null;
  vat_number: string | null;
  tax_number: string | null;
  customer_number: string | null;
  status: CompanyStatus;
  owner_id: string | null;
  description: string | null;
  custom_fields: Record<string, Json>;
  sevdesk_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

type Contact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  salutation: string | null;
  academic_title: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  company_id: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  country: string | null;
  birthday: string | null;
  linkedin_url: string | null;
  status: ContactStatus;
  owner_id: string | null;
  description: string | null;
  custom_fields: Record<string, Json>;
  sevdesk_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** generierte Spalte — nur lesbar */
  full_name: string;
}

type Pipeline = {
  id: string;
  name: string;
  position: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

type Stage = {
  id: string;
  pipeline_id: string;
  name: string;
  position: number;
  probability: number;
  rotting_days: number | null;
  created_at: string;
  updated_at: string;
}

type LostReason = {
  id: string;
  label: string;
  position: number;
}

type Deal = {
  id: string;
  title: string;
  value: number;
  currency: string;
  pipeline_id: string;
  stage_id: string;
  contact_id: string | null;
  company_id: string | null;
  owner_id: string | null;
  status: DealStatus;
  probability: number | null;
  expected_close_date: string | null;
  won_at: string | null;
  lost_at: string | null;
  lost_reason_id: string | null;
  lost_comment: string | null;
  source: string | null;
  description: string | null;
  custom_fields: Record<string, Json>;
  position: number;
  stage_changed_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

type DealStageHistory = {
  id: number;
  deal_id: string;
  from_stage_id: string | null;
  to_stage_id: string;
  changed_by: string | null;
  changed_at: string;
}

type Activity = {
  id: string;
  type: ActivityType;
  subject: string;
  notes: string | null;
  due_at: string | null;
  duration_minutes: number | null;
  done: boolean;
  done_at: string | null;
  deal_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  /** Projektbezug — Projektaufgaben sind dieselben Aufgaben, kein zweites System */
  project_id: string | null;
  section_id: string | null;
  position: number;
  owner_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

type Project = {
  id: string;
  name: string;
  description: string | null;
  company_id: string | null;
  deal_id: string | null;
  owner_id: string | null;
  status: ProjectStatus;
  color: string;
  starts_on: string | null;
  due_on: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

type ProjectSection = {
  id: string;
  project_id: string;
  name: string;
  position: number;
  created_at: string;
}

type Document = {
  id: string;
  name: string;
  mime_type: string | null;
  size_bytes: number | null;
  storage_path: string;
  description: string | null;
  company_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  project_id: string | null;
  uploaded_by: string | null;
  created_at: string;
}

type Note = {
  id: string;
  body: string;
  deal_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

type Tag = {
  id: string;
  label: string;
  color: string;
  created_at: string;
}

type Tagging = {
  tag_id: string;
  entity: EntityType;
  entity_id: string;
  created_at: string;
}

type CustomFieldDef = {
  id: string;
  entity: EntityType;
  key: string;
  label: string;
  field_type: FieldType;
  options: string[];
  position: number;
  required: boolean;
  created_at: string;
}

type Conversation = {
  id: string;
  subject: string | null;
  channel: ChannelType;
  contact_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  counterparty: string;
  external_id: string | null;
  last_message_at: string;
  unread_count: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

type Message = {
  id: string;
  conversation_id: string;
  direction: DirectionType;
  body: string;
  body_html: string | null;
  from_addr: string | null;
  to_addr: string | null;
  external_id: string | null;
  sent_at: string;
  created_by: string | null;
  created_at: string;
}

type BookingSetting = {
  id: string;
  owner_id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  buffer_minutes: number;
  timezone: string;
  availability: Record<string, [string, string][]>;
  lead_time_hours: number;
  horizon_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type Appointment = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  meeting_url: string | null;
  notes: string | null;
  status: ApptStatus;
  contact_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  owner_id: string | null;
  booking_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

type AuditEntry = {
  id: number;
  entity: string;
  entity_id: string;
  action: string;
  actor_id: string | null;
  changes: Json;
  created_at: string;
}

/** Felder, die die Datenbank selbst setzt und die beim Insert entfallen. */
type Generated = 'id' | 'created_at' | 'updated_at';

/**
 * supabase-js löst seine Generics über genau diese Struktur auf — fehlt
 * `Relationships` oder `CompositeTypes`, fällt die Ableitung stillschweigend
 * auf `never` zurück und jede Abfrage schlägt beim Typecheck fehl.
 *
 * `Relationships` bleibt leer: die eingebetteten Selects (`owner:profiles!...`)
 * werden an der Aufrufstelle explizit typisiert. Sobald das Supabase-Projekt
 * steht, ersetzt der Generator diese Datei vollständig.
 */
type TableDef<Row, Extra extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Pick<Row, Extract<Generated, keyof Row>>> &
    Partial<Omit<Row, Generated | Extra>>;
  Update: Partial<Omit<Row, Extra>>;
  Relationships: [];
};

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '12';
  };
  public: {
    Tables: {
      profiles: TableDef<Profile>;
      companies: TableDef<Company>;
      contacts: TableDef<Contact, 'full_name'>;
      pipelines: TableDef<Pipeline>;
      stages: TableDef<Stage>;
      lost_reasons: TableDef<LostReason>;
      deals: TableDef<Deal>;
      deal_stage_history: TableDef<DealStageHistory>;
      activities: TableDef<Activity>;
      notes: TableDef<Note>;
      projects: TableDef<Project>;
      project_sections: TableDef<ProjectSection>;
      documents: TableDef<Document>;
      tags: TableDef<Tag>;
      taggings: TableDef<Tagging>;
      custom_field_defs: TableDef<CustomFieldDef>;
      conversations: TableDef<Conversation>;
      messages: TableDef<Message>;
      booking_settings: TableDef<BookingSetting>;
      appointments: TableDef<Appointment>;
      audit_log: TableDef<AuditEntry>;
    };
    Views: { [_ in never]: never };
    Functions: {
      search_global: {
        Args: { q: string; max_rows?: number };
        Returns: { entity: EntityType; id: string; title: string; subtitle: string | null; score: number }[];
      };
      move_deal: {
        Args: { p_deal_id: string; p_stage_id: string; p_before_id?: string | null; p_after_id?: string | null };
        Returns: Deal;
      };
      win_deal: { Args: { p_deal_id: string }; Returns: Deal };
      lose_deal: {
        Args: { p_deal_id: string; p_reason_id?: string | null; p_comment?: string | null };
        Returns: Deal;
      };
      reopen_deal: { Args: { p_deal_id: string }; Returns: Deal };
      dashboard_metrics: {
        Args: { p_from: string; p_to: string; p_owner_id?: string | null };
        Returns: DashboardMetrics;
      };
      project_progress: {
        Args: { p_project_ids?: string[] | null };
        Returns: { project_id: string; aufgaben: number; erledigt: number; ueberfaellig: number }[];
      };
      move_task: {
        Args: { p_task_id: string; p_section_id: string; p_before_id?: string | null; p_after_id?: string | null };
        Returns: Activity;
      };
      board_summary: {
        Args: { p_pipeline_id: string; p_owner_id?: string | null };
        Returns: { stage_id: string; deal_count: number; total_value: number }[];
      };
      pipeline_conversion: {
        Args: { p_pipeline_id: string };
        Returns: { stage_id: string; stage_name: string; stage_position: number; reached: number; won: number }[];
      };
      booking_page: { Args: { p_slug: string }; Returns: BookingPage | null };
      booking_slots: { Args: { p_slug: string; p_day: string }; Returns: string[] };
      book_slot: {
        Args: {
          p_slug: string;
          p_starts_at: string;
          p_guest_name: string;
          p_guest_email: string;
          p_guest_phone?: string | null;
          p_notes?: string | null;
        };
        Returns: { id: string; starts_at: string; duration_minutes: number; timezone: string };
      };
    };
    Enums: {
      app_role: AppRole;
      entity_type: EntityType;
      company_status: CompanyStatus;
      contact_status: ContactStatus;
      deal_status: DealStatus;
      activity_type: ActivityType;
      channel_type: ChannelType;
      direction_type: DirectionType;
      field_type: FieldType;
      appt_status: ApptStatus;
      project_status: ProjectStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
}

export type DashboardMetrics = {
  won_value: number;
  won_value_prev: number;
  won_count: number;
  lost_count: number;
  created_count: number;
  open_value: number;
  open_count: number;
  forecast: number;
  avg_deal_size: number;
  avg_cycle_days: number;
  activities_done: number;
  activities_overdue: number;
  by_stage: { stage_id: string; name: string; position: number; count: number; value: number }[];
  won_series: { day: string; value: number }[];
}

export type BookingPage = {
  slug: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  timezone: string;
  horizon_days: number;
  host_name: string | null;
}
