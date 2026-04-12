import { Database } from "@/integrations/supabase/types";

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];

export type Contact = Tables<"contacts">;
export type Company = Tables<"companies">;
export type Deal = Tables<"deals">;
export type Activity = Tables<"activities">;
export type VoiceLead = Tables<"voice_leads">;

export type ContactWithCompany = Contact & { companies: Pick<Company, "name"> | null };
export type DealWithRelations = Deal & { 
  contacts: Pick<Contact, "first_name" | "last_name"> | null;
  companies: Pick<Company, "name"> | null;
};
