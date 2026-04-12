export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          company_id: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          due_date: string | null
          id: string
          owner_id: string
          title: string
          type: Database["public"]["Enums"]["activity_type"]
        }
        Insert: {
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          owner_id: string
          title: string
          type: Database["public"]["Enums"]["activity_type"]
        }
        Update: {
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          owner_id?: string
          title?: string
          type?: Database["public"]["Enums"]["activity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          booking_token: string | null
          contact_email: string | null
          contact_id: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          end_time: string
          id: string
          notes: string | null
          owner_id: string
          start_time: string
          status: Database["public"]["Enums"]["appointment_status"]
          title: string
        }
        Insert: {
          booking_token?: string | null
          contact_email?: string | null
          contact_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          end_time: string
          id?: string
          notes?: string | null
          owner_id: string
          start_time: string
          status?: Database["public"]["Enums"]["appointment_status"]
          title: string
        }
        Update: {
          booking_token?: string | null
          contact_email?: string | null
          contact_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          end_time?: string
          id?: string
          notes?: string | null
          owner_id?: string
          start_time?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_settings: {
        Row: {
          available_days: number[]
          booking_page_description: string | null
          booking_page_slug: string | null
          booking_page_title: string | null
          created_at: string
          end_hour: number
          id: string
          owner_id: string
          slot_duration: number
          start_hour: number
        }
        Insert: {
          available_days?: number[]
          booking_page_description?: string | null
          booking_page_slug?: string | null
          booking_page_title?: string | null
          created_at?: string
          end_hour?: number
          id?: string
          owner_id: string
          slot_duration?: number
          start_hour?: number
        }
        Update: {
          available_days?: number[]
          booking_page_description?: string | null
          booking_page_slug?: string | null
          booking_page_title?: string | null
          created_at?: string
          end_hour?: number
          id?: string
          owner_id?: string
          slot_duration?: number
          start_hour?: number
        }
        Relationships: []
      }
      companies: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          id: string
          industry: string | null
          name: string
          notes: string | null
          owner_id: string
          size: Database["public"]["Enums"]["company_size"] | null
          status: string
          website: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          name: string
          notes?: string | null
          owner_id: string
          size?: Database["public"]["Enums"]["company_size"] | null
          status?: string
          website?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          name?: string
          notes?: string | null
          owner_id?: string
          size?: Database["public"]["Enums"]["company_size"] | null
          status?: string
          website?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          company_id: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_activity_at: string | null
          last_name: string
          notes: string | null
          owner_id: string
          phone: string | null
          position: string | null
          source: Database["public"]["Enums"]["contact_source"]
          status: Database["public"]["Enums"]["contact_status"]
          tags: string[] | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          last_activity_at?: string | null
          last_name: string
          notes?: string | null
          owner_id: string
          phone?: string | null
          position?: string | null
          source?: Database["public"]["Enums"]["contact_source"]
          status?: Database["public"]["Enums"]["contact_status"]
          tags?: string[] | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_activity_at?: string | null
          last_name?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          position?: string | null
          source?: Database["public"]["Enums"]["contact_source"]
          status?: Database["public"]["Enums"]["contact_status"]
          tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          channel: Database["public"]["Enums"]["conversation_channel"]
          contact_id: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          owner_id: string
          unread_count: number
        }
        Insert: {
          channel?: Database["public"]["Enums"]["conversation_channel"]
          contact_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          owner_id: string
          unread_count?: number
        }
        Update: {
          channel?: Database["public"]["Enums"]["conversation_channel"]
          contact_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          owner_id?: string
          unread_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          close_date: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          currency: string
          id: string
          lost_reason: string | null
          notes: string | null
          owner_id: string
          probability: number
          stage: Database["public"]["Enums"]["deal_stage"]
          title: string
          value: number
        }
        Insert: {
          close_date?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          lost_reason?: string | null
          notes?: string | null
          owner_id: string
          probability?: number
          stage?: Database["public"]["Enums"]["deal_stage"]
          title: string
          value?: number
        }
        Update: {
          close_date?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          lost_reason?: string | null
          notes?: string | null
          owner_id?: string
          probability?: number
          stage?: Database["public"]["Enums"]["deal_stage"]
          title?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"]
          external_id: string | null
          id: string
          status: Database["public"]["Enums"]["message_status"]
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["message_direction"]
          external_id?: string | null
          id?: string
          status?: Database["public"]["Enums"]["message_status"]
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"]
          external_id?: string | null
          id?: string
          status?: Database["public"]["Enums"]["message_status"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_automations: {
        Row: {
          action_config: Json
          action_type: Database["public"]["Enums"]["automation_action_type"]
          created_at: string
          deal_stage: Database["public"]["Enums"]["deal_stage"]
          enabled: boolean
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          action_config?: Json
          action_type: Database["public"]["Enums"]["automation_action_type"]
          created_at?: string
          deal_stage: Database["public"]["Enums"]["deal_stage"]
          enabled?: boolean
          id?: string
          name?: string
          owner_id: string
        }
        Update: {
          action_config?: Json
          action_type?: Database["public"]["Enums"]["automation_action_type"]
          created_at?: string
          deal_stage?: Database["public"]["Enums"]["deal_stage"]
          enabled?: boolean
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      voice_leads: {
        Row: {
          ai_score: number | null
          caller_name: string
          caller_phone: string | null
          converted_contact_id: string | null
          created_at: string
          id: string
          intent: Database["public"]["Enums"]["voice_lead_intent"]
          owner_id: string
          status: Database["public"]["Enums"]["voice_lead_status"]
          summary: string | null
          transcript: string | null
        }
        Insert: {
          ai_score?: number | null
          caller_name: string
          caller_phone?: string | null
          converted_contact_id?: string | null
          created_at?: string
          id?: string
          intent?: Database["public"]["Enums"]["voice_lead_intent"]
          owner_id: string
          status?: Database["public"]["Enums"]["voice_lead_status"]
          summary?: string | null
          transcript?: string | null
        }
        Update: {
          ai_score?: number | null
          caller_name?: string
          caller_phone?: string | null
          converted_contact_id?: string | null
          created_at?: string
          id?: string
          intent?: Database["public"]["Enums"]["voice_lead_intent"]
          owner_id?: string
          status?: Database["public"]["Enums"]["voice_lead_status"]
          summary?: string | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_leads_converted_contact_id_fkey"
            columns: ["converted_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      activity_type: "call" | "email" | "meeting" | "task" | "note"
      appointment_status: "scheduled" | "completed" | "cancelled"
      automation_action_type:
        | "send_email"
        | "send_sms"
        | "create_task"
        | "webhook"
      company_size: "startup" | "smb" | "mid_market" | "enterprise"
      contact_source: "manual" | "voice_ai" | "website" | "referral"
      contact_status: "lead" | "prospect" | "customer" | "inactive"
      conversation_channel: "sms" | "whatsapp"
      deal_stage:
        | "lead"
        | "qualified"
        | "proposal"
        | "negotiation"
        | "won"
        | "lost"
      message_direction: "inbound" | "outbound"
      message_status: "sent" | "delivered" | "read" | "failed"
      voice_lead_intent: "information" | "appointment" | "callback" | "other"
      voice_lead_status: "new" | "contacted" | "converted" | "dismissed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_type: ["call", "email", "meeting", "task", "note"],
      appointment_status: ["scheduled", "completed", "cancelled"],
      automation_action_type: [
        "send_email",
        "send_sms",
        "create_task",
        "webhook",
      ],
      company_size: ["startup", "smb", "mid_market", "enterprise"],
      contact_source: ["manual", "voice_ai", "website", "referral"],
      contact_status: ["lead", "prospect", "customer", "inactive"],
      conversation_channel: ["sms", "whatsapp"],
      deal_stage: [
        "lead",
        "qualified",
        "proposal",
        "negotiation",
        "won",
        "lost",
      ],
      message_direction: ["inbound", "outbound"],
      message_status: ["sent", "delivered", "read", "failed"],
      voice_lead_intent: ["information", "appointment", "callback", "other"],
      voice_lead_status: ["new", "contacted", "converted", "dismissed"],
    },
  },
} as const
