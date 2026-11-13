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
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      freelancer_profiles: {
        Row: {
          created_at: string
          headline: string | null
          major: string | null
          skills: string[]
          status: Database["public"]["Enums"]["freelancer_status"]
          university_id: string
          updated_at: string
          user_id: string
          verified_until: string
        }
        Insert: {
          created_at?: string
          headline?: string | null
          major?: string | null
          skills?: string[]
          status?: Database["public"]["Enums"]["freelancer_status"]
          university_id: string
          updated_at?: string
          user_id: string
          verified_until: string
        }
        Update: {
          created_at?: string
          headline?: string | null
          major?: string | null
          skills?: string[]
          status?: Database["public"]["Enums"]["freelancer_status"]
          university_id?: string
          updated_at?: string
          user_id?: string
          verified_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "freelancer_profiles_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freelancer_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          bio: string | null
          created_at: string
          full_name: string | null
          id: string
          location: string | null
          onboarded_at: string | null
          terms_accepted_at: string | null
          updated_at: string
          username: string
        }
        Insert: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          location?: string | null
          onboarded_at?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          location?: string | null
          onboarded_at?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      categories: {
        Row: { id: string; slug: string; name: string; sort_order: number; is_active: boolean }
        Insert: { id?: string; slug: string; name: string; sort_order?: number; is_active?: boolean }
        Update: { id?: string; slug?: string; name?: string; sort_order?: number; is_active?: boolean }
        Relationships: []
      }
      portfolio_items: {
        Row: { id: string; freelancer_id: string; title: string; description: string | null; external_url: string | null; image_paths: string[]; sort_order: number; created_at: string; updated_at: string }
        Insert: { id?: string; freelancer_id: string; title: string; description?: string | null; external_url?: string | null; image_paths?: string[]; sort_order?: number; created_at?: string; updated_at?: string }
        Update: { id?: string; freelancer_id?: string; title?: string; description?: string | null; external_url?: string | null; image_paths?: string[]; sort_order?: number; updated_at?: string }
        Relationships: []
      }
      services: {
        Row: { id: string; freelancer_id: string; category_id: string; title: string; description: string; price: number; delivery_days: number; revisions_included: number; requirements_prompt: string | null; cover_image_path: string | null; status: Database["public"]["Enums"]["service_status"]; published_at: string | null; blocked_at: string | null; blocked_reason: string | null; search: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; freelancer_id: string; category_id: string; title: string; description: string; price: number; delivery_days: number; revisions_included?: number; requirements_prompt?: string | null; cover_image_path?: string | null; status?: Database["public"]["Enums"]["service_status"]; published_at?: string | null; blocked_at?: string | null; blocked_reason?: string | null; created_at?: string; updated_at?: string }
        Update: { category_id?: string; title?: string; description?: string; price?: number; delivery_days?: number; revisions_included?: number; requirements_prompt?: string | null; cover_image_path?: string | null; status?: Database["public"]["Enums"]["service_status"]; published_at?: string | null; blocked_at?: string | null; blocked_reason?: string | null; updated_at?: string }
        Relationships: []
      }
      jobs: {
        Row: { id: string; client_id: string; category_id: string; title: string; description: string; requirements: string | null; budget_min: number; budget_max: number; deadline: string | null; status: Database["public"]["Enums"]["job_status"]; closed_at: string | null; closed_reason: string | null; search: unknown; created_at: string; updated_at: string }
        Insert: { id?: string; client_id: string; category_id: string; title: string; description: string; requirements?: string | null; budget_min: number; budget_max: number; deadline?: string | null; status?: Database["public"]["Enums"]["job_status"]; closed_at?: string | null; closed_reason?: string | null; created_at?: string; updated_at?: string }
        Update: { category_id?: string; title?: string; description?: string; requirements?: string | null; budget_min?: number; budget_max?: number; deadline?: string | null; status?: Database["public"]["Enums"]["job_status"]; closed_at?: string | null; closed_reason?: string | null; updated_at?: string }
        Relationships: [
          { foreignKeyName: "jobs_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "jobs_category_id_fkey"; columns: ["category_id"]; isOneToOne: false; referencedRelation: "categories"; referencedColumns: ["id"] },
        ]
      }
      proposals: {
        Row: { id: string; job_id: string; freelancer_id: string; cover_letter: string; price: number; delivery_days: number; revisions_included: number; status: Database["public"]["Enums"]["proposal_status"]; status_reason: string | null; decided_at: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; job_id: string; freelancer_id: string; cover_letter: string; price: number; delivery_days: number; revisions_included: number; status?: Database["public"]["Enums"]["proposal_status"]; status_reason?: string | null; decided_at?: string | null; created_at?: string; updated_at?: string }
        Update: { cover_letter?: string; price?: number; delivery_days?: number; revisions_included?: number; status?: Database["public"]["Enums"]["proposal_status"]; status_reason?: string | null; decided_at?: string | null; updated_at?: string }
        Relationships: [
          { foreignKeyName: "proposals_job_id_fkey"; columns: ["job_id"]; isOneToOne: false; referencedRelation: "jobs"; referencedColumns: ["id"] },
          { foreignKeyName: "proposals_freelancer_id_fkey"; columns: ["freelancer_id"]; isOneToOne: false; referencedRelation: "freelancer_profiles"; referencedColumns: ["user_id"] },
        ]
      }
      orders: {
        Row: { id: string; order_number: number; source: Database["public"]["Enums"]["order_source"]; service_id: string | null; job_id: string | null; proposal_id: string | null; client_id: string; freelancer_id: string; title: string; brief: string; requirements: string | null; amount: number; platform_fee: number; freelancer_earnings: number; delivery_days: number; revisions_allowed: number; revisions_used: number; status: Database["public"]["Enums"]["order_status"]; payment_due_at: string; paid_at: string | null; due_at: string | null; delivered_at: string | null; completed_at: string | null; cancelled_at: string | null; cancelled_by: string | null; cancellation_reason: string | null; payout_status: Database["public"]["Enums"]["payout_status"]; payout_reference: string | null; payout_marked_by: string | null; payout_marked_at: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; source: Database["public"]["Enums"]["order_source"]; service_id?: string | null; job_id?: string | null; proposal_id?: string | null; client_id: string; freelancer_id: string; title: string; brief: string; requirements?: string | null; amount: number; platform_fee: number; freelancer_earnings: number; delivery_days: number; revisions_allowed: number; revisions_used?: number; status?: Database["public"]["Enums"]["order_status"]; payment_due_at: string; created_at?: string; updated_at?: string }
        Update: { status?: Database["public"]["Enums"]["order_status"]; updated_at?: string }
        Relationships: [
          { foreignKeyName: "orders_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "orders_freelancer_id_fkey"; columns: ["freelancer_id"]; isOneToOne: false; referencedRelation: "freelancer_profiles"; referencedColumns: ["user_id"] },
          { foreignKeyName: "orders_job_id_fkey"; columns: ["job_id"]; isOneToOne: false; referencedRelation: "jobs"; referencedColumns: ["id"] },
          { foreignKeyName: "orders_proposal_id_fkey"; columns: ["proposal_id"]; isOneToOne: true; referencedRelation: "proposals"; referencedColumns: ["id"] },
          { foreignKeyName: "orders_service_id_fkey"; columns: ["service_id"]; isOneToOne: false; referencedRelation: "services"; referencedColumns: ["id"] },
          { foreignKeyName: "orders_cancelled_by_fkey"; columns: ["cancelled_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "orders_payout_marked_by_fkey"; columns: ["payout_marked_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
      order_events: {
        Row: { id: number; order_id: string; actor_id: string | null; event_type: string; from_status: Database["public"]["Enums"]["order_status"] | null; to_status: Database["public"]["Enums"]["order_status"] | null; payload: Json; created_at: string }
        Insert: { id?: never; order_id: string; actor_id?: string | null; event_type: string; from_status?: Database["public"]["Enums"]["order_status"] | null; to_status?: Database["public"]["Enums"]["order_status"] | null; payload?: Json; created_at?: string }
        Update: { id?: never }
        Relationships: [
          { foreignKeyName: "order_events_order_id_fkey"; columns: ["order_id"]; isOneToOne: false; referencedRelation: "orders"; referencedColumns: ["id"] },
          { foreignKeyName: "order_events_actor_id_fkey"; columns: ["actor_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
      student_verifications: {
        Row: {
          created_at: string
          document_path: string | null
          id: string
          method: Database["public"]["Enums"]["verification_method"]
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["verification_status"]
          student_number: string | null
          university_id: string
          user_id: string
          valid_until: string | null
          verified_email: string | null
        }
        Insert: {
          created_at?: string
          document_path?: string | null
          id?: string
          method: Database["public"]["Enums"]["verification_method"]
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          student_number?: string | null
          university_id: string
          user_id: string
          valid_until?: string | null
          verified_email?: string | null
        }
        Update: {
          created_at?: string
          document_path?: string | null
          id?: string
          method?: Database["public"]["Enums"]["verification_method"]
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          student_number?: string | null
          university_id?: string
          user_id?: string
          valid_until?: string | null
          verified_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_verifications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_verifications_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      universities: {
        Row: {
          created_at: string
          email_domains: string[]
          id: string
          is_active: boolean
          name: string
          short_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_domains?: string[]
          id?: string
          is_active?: boolean
          name: string
          short_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_domains?: string[]
          id?: string
          is_active?: boolean
          name?: string
          short_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      service_listings: {
        Row: {
          id: string; freelancer_id: string; category_id: string; title: string; description: string;
          price: number; delivery_days: number; revisions_included: number; requirements_prompt: string | null;
          cover_image_path: string | null; published_at: string | null; created_at: string; updated_at: string;
          category_slug: string; category_name: string; freelancer_username: string; freelancer_name: string | null;
          freelancer_avatar_path: string | null; freelancer_headline: string | null; freelancer_skills: string[];
          university_name: string; university_short_name: string | null;
        }
        Relationships: []
      }
    }
    Functions: {
      complete_onboarding: {
        Args: {
          p_accept_terms: boolean
          p_full_name: string
          p_username: string
        }
        Returns: {
          avatar_path: string | null
          bio: string | null
          created_at: string
          full_name: string | null
          id: string
          location: string | null
          onboarded_at: string | null
          terms_accepted_at: string | null
          updated_at: string
          username: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_my_verification_status: {
        Args: never
        Returns: {
          can_submit: boolean
          is_suspended: boolean
          latest_rejection_reason: string
          latest_request_id: string
          latest_request_status: Database["public"]["Enums"]["verification_status"]
          state: Database["public"]["Enums"]["student_verification_state"]
          university_id: string
          verified_until: string
        }[]
      }
      review_student_verification: {
        Args: {
          p_decision: string
          p_reason?: string
          p_valid_until?: string
          p_verification_id: string
        }
        Returns: {
          created_at: string
          document_path: string | null
          id: string
          method: Database["public"]["Enums"]["verification_method"]
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["verification_status"]
          student_number: string | null
          university_id: string
          user_id: string
          valid_until: string | null
          verified_email: string | null
        }
        SetofOptions: {
          from: "*"
          to: "student_verifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_student_verification: {
        Args: {
          p_document_path?: string
          p_method: Database["public"]["Enums"]["verification_method"]
          p_student_number?: string
          p_university_id: string
        }
        Returns: {
          created_at: string
          document_path: string | null
          id: string
          method: Database["public"]["Enums"]["verification_method"]
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["verification_status"]
          student_number: string | null
          university_id: string
          user_id: string
          valid_until: string | null
          verified_email: string | null
        }
        SetofOptions: {
          from: "*"
          to: "student_verifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_job: {
        Args: { p_job_id: string; p_reason?: string }
        Returns: Database["public"]["Tables"]["jobs"]["Row"]
        SetofOptions: { from: "*"; to: "jobs"; isOneToOne: true; isSetofReturn: false }
      }
      submit_proposal: {
        Args: { p_job_id: string; p_cover_letter: string; p_price: number; p_delivery_days: number; p_revisions_included: number }
        Returns: Database["public"]["Tables"]["proposals"]["Row"]
        SetofOptions: { from: "*"; to: "proposals"; isOneToOne: true; isSetofReturn: false }
      }
      withdraw_proposal: {
        Args: { p_proposal_id: string }
        Returns: Database["public"]["Tables"]["proposals"]["Row"]
        SetofOptions: { from: "*"; to: "proposals"; isOneToOne: true; isSetofReturn: false }
      }
      reject_proposal: {
        Args: { p_proposal_id: string; p_reason?: string }
        Returns: Database["public"]["Tables"]["proposals"]["Row"]
        SetofOptions: { from: "*"; to: "proposals"; isOneToOne: true; isSetofReturn: false }
      }
      accept_proposal: { Args: { p_proposal_id: string }; Returns: string }
      cancel_order: { Args: { p_order_id: string; p_reason: string }; Returns: string[] }
      set_service_status: {
        Args: { p_service_id: string; p_status: Database["public"]["Enums"]["service_status"] }
        Returns: Database["public"]["Tables"]["services"]["Row"]
        SetofOptions: { from: "*"; to: "services"; isOneToOne: true; isSetofReturn: false }
      }
    }
    Enums: {
      freelancer_status: "active" | "suspended"
      student_verification_state:
        | "unverified"
        | "pending"
        | "verified"
        | "rejected"
      verification_method: "email_domain" | "document"
      verification_status: "pending" | "approved" | "rejected"
      service_status: "draft" | "published" | "paused" | "archived"
      job_status: "open" | "hiring" | "filled" | "closed"
      proposal_status: "submitted" | "accepted" | "rejected" | "withdrawn"
      order_source: "service" | "job"
      order_status: "awaiting_payment" | "in_progress" | "delivered" | "completed" | "cancelled" | "disputed"
      payout_status: "none" | "pending" | "paid"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      freelancer_status: ["active", "suspended"],
      student_verification_state: [
        "unverified",
        "pending",
        "verified",
        "rejected",
      ],
      verification_method: ["email_domain", "document"],
      verification_status: ["pending", "approved", "rejected"],
      service_status: ["draft", "published", "paused", "archived"],
      job_status: ["open", "hiring", "filled", "closed"],
      proposal_status: ["submitted", "accepted", "rejected", "withdrawn"],
      order_source: ["service", "job"],
      order_status: ["awaiting_payment", "in_progress", "delivered", "completed", "cancelled", "disputed"],
      payout_status: ["none", "pending", "paid"],
    },
  },
} as const
