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
      categories: {
        Row: {
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
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
      jobs: {
        Row: {
          budget_max: number
          budget_min: number
          category_id: string
          client_id: string
          closed_at: string | null
          closed_reason: string | null
          created_at: string
          deadline: string | null
          description: string
          id: string
          requirements: string | null
          search: unknown
          status: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at: string
        }
        Insert: {
          budget_max: number
          budget_min: number
          category_id: string
          client_id: string
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          deadline?: string | null
          description: string
          id?: string
          requirements?: string | null
          search?: unknown
          status?: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at?: string
        }
        Update: {
          budget_max?: number
          budget_min?: number
          category_id?: string
          client_id?: string
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          deadline?: string | null
          description?: string
          id?: string
          requirements?: string | null
          search?: unknown
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: number
          order_id: string
          payload: Json
          to_status: Database["public"]["Enums"]["order_status"] | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: never
          order_id: string
          payload?: Json
          to_status?: Database["public"]["Enums"]["order_status"] | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: never
          order_id?: string
          payload?: Json
          to_status?: Database["public"]["Enums"]["order_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "order_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount: number
          brief: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_id: string
          completed_at: string | null
          created_at: string
          delivered_at: string | null
          delivery_days: number
          due_at: string | null
          freelancer_earnings: number
          freelancer_id: string
          id: string
          job_id: string | null
          order_number: number
          paid_at: string | null
          payment_due_at: string
          payout_marked_at: string | null
          payout_marked_by: string | null
          payout_reference: string | null
          payout_status: Database["public"]["Enums"]["payout_status"]
          platform_fee: number
          proposal_id: string | null
          requirements: string | null
          revisions_allowed: number
          revisions_used: number
          service_id: string | null
          source: Database["public"]["Enums"]["order_source"]
          status: Database["public"]["Enums"]["order_status"]
          title: string
          updated_at: string
        }
        Insert: {
          amount: number
          brief: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_id: string
          completed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_days: number
          due_at?: string | null
          freelancer_earnings: number
          freelancer_id: string
          id?: string
          job_id?: string | null
          order_number?: never
          paid_at?: string | null
          payment_due_at: string
          payout_marked_at?: string | null
          payout_marked_by?: string | null
          payout_reference?: string | null
          payout_status?: Database["public"]["Enums"]["payout_status"]
          platform_fee: number
          proposal_id?: string | null
          requirements?: string | null
          revisions_allowed: number
          revisions_used?: number
          service_id?: string | null
          source: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          brief?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_id?: string
          completed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_days?: number
          due_at?: string | null
          freelancer_earnings?: number
          freelancer_id?: string
          id?: string
          job_id?: string | null
          order_number?: never
          paid_at?: string | null
          payment_due_at?: string
          payout_marked_at?: string | null
          payout_marked_by?: string | null
          payout_reference?: string | null
          payout_status?: Database["public"]["Enums"]["payout_status"]
          platform_fee?: number
          proposal_id?: string | null
          requirements?: string | null
          revisions_allowed?: number
          revisions_used?: number
          service_id?: string | null
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "freelancer_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "orders_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_payout_marked_by_fkey"
            columns: ["payout_marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: true
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_items: {
        Row: {
          created_at: string
          description: string | null
          external_url: string | null
          freelancer_id: string
          id: string
          image_paths: string[]
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          external_url?: string | null
          freelancer_id: string
          id?: string
          image_paths?: string[]
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          external_url?: string | null
          freelancer_id?: string
          id?: string
          image_paths?: string[]
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_items_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "freelancer_profiles"
            referencedColumns: ["user_id"]
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
      proposals: {
        Row: {
          cover_letter: string
          created_at: string
          decided_at: string | null
          delivery_days: number
          freelancer_id: string
          id: string
          job_id: string
          price: number
          revisions_included: number
          status: Database["public"]["Enums"]["proposal_status"]
          status_reason: string | null
          updated_at: string
        }
        Insert: {
          cover_letter: string
          created_at?: string
          decided_at?: string | null
          delivery_days: number
          freelancer_id: string
          id?: string
          job_id: string
          price: number
          revisions_included: number
          status?: Database["public"]["Enums"]["proposal_status"]
          status_reason?: string | null
          updated_at?: string
        }
        Update: {
          cover_letter?: string
          created_at?: string
          decided_at?: string | null
          delivery_days?: number
          freelancer_id?: string
          id?: string
          job_id?: string
          price?: number
          revisions_included?: number
          status?: Database["public"]["Enums"]["proposal_status"]
          status_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "freelancer_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "proposals_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          blocked_at: string | null
          blocked_reason: string | null
          category_id: string
          cover_image_path: string | null
          created_at: string
          delivery_days: number
          description: string
          freelancer_id: string
          id: string
          price: number
          published_at: string | null
          requirements_prompt: string | null
          revisions_included: number
          search: unknown
          status: Database["public"]["Enums"]["service_status"]
          title: string
          updated_at: string
        }
        Insert: {
          blocked_at?: string | null
          blocked_reason?: string | null
          category_id: string
          cover_image_path?: string | null
          created_at?: string
          delivery_days: number
          description: string
          freelancer_id: string
          id?: string
          price: number
          published_at?: string | null
          requirements_prompt?: string | null
          revisions_included?: number
          search?: unknown
          status?: Database["public"]["Enums"]["service_status"]
          title: string
          updated_at?: string
        }
        Update: {
          blocked_at?: string | null
          blocked_reason?: string | null
          category_id?: string
          cover_image_path?: string | null
          created_at?: string
          delivery_days?: number
          description?: string
          freelancer_id?: string
          id?: string
          price?: number
          published_at?: string | null
          requirements_prompt?: string | null
          revisions_included?: number
          search?: unknown
          status?: Database["public"]["Enums"]["service_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "freelancer_profiles"
            referencedColumns: ["user_id"]
          },
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
          category_id: string | null
          category_name: string | null
          category_slug: string | null
          cover_image_path: string | null
          created_at: string | null
          delivery_days: number | null
          description: string | null
          freelancer_avatar_path: string | null
          freelancer_headline: string | null
          freelancer_id: string | null
          freelancer_name: string | null
          freelancer_skills: string[] | null
          freelancer_username: string | null
          id: string | null
          price: number | null
          published_at: string | null
          requirements_prompt: string | null
          revisions_included: number | null
          title: string | null
          university_name: string | null
          university_short_name: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "freelancer_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Functions: {
      accept_proposal: { Args: { p_proposal_id: string }; Returns: string }
      cancel_order: {
        Args: { p_order_id: string; p_reason: string }
        Returns: string[]
      }
      close_job: {
        Args: { p_job_id: string; p_reason?: string }
        Returns: {
          budget_max: number
          budget_min: number
          category_id: string
          client_id: string
          closed_at: string | null
          closed_reason: string | null
          created_at: string
          deadline: string | null
          description: string
          id: string
          requirements: string | null
          search: unknown
          status: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
      reject_proposal: {
        Args: { p_proposal_id: string; p_reason?: string }
        Returns: {
          cover_letter: string
          created_at: string
          decided_at: string | null
          delivery_days: number
          freelancer_id: string
          id: string
          job_id: string
          price: number
          revisions_included: number
          status: Database["public"]["Enums"]["proposal_status"]
          status_reason: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "proposals"
          isOneToOne: true
          isSetofReturn: false
        }
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
      set_service_status: {
        Args: {
          p_service_id: string
          p_status: Database["public"]["Enums"]["service_status"]
        }
        Returns: {
          blocked_at: string | null
          blocked_reason: string | null
          category_id: string
          cover_image_path: string | null
          created_at: string
          delivery_days: number
          description: string
          freelancer_id: string
          id: string
          price: number
          published_at: string | null
          requirements_prompt: string | null
          revisions_included: number
          search: unknown
          status: Database["public"]["Enums"]["service_status"]
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "services"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_proposal: {
        Args: {
          p_cover_letter: string
          p_delivery_days: number
          p_job_id: string
          p_price: number
          p_revisions_included: number
        }
        Returns: {
          cover_letter: string
          created_at: string
          decided_at: string | null
          delivery_days: number
          freelancer_id: string
          id: string
          job_id: string
          price: number
          revisions_included: number
          status: Database["public"]["Enums"]["proposal_status"]
          status_reason: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "proposals"
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
      withdraw_proposal: {
        Args: { p_proposal_id: string }
        Returns: {
          cover_letter: string
          created_at: string
          decided_at: string | null
          delivery_days: number
          freelancer_id: string
          id: string
          job_id: string
          price: number
          revisions_included: number
          status: Database["public"]["Enums"]["proposal_status"]
          status_reason: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "proposals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      freelancer_status: "active" | "suspended"
      job_status: "open" | "hiring" | "filled" | "closed"
      order_source: "service" | "job"
      order_status:
        | "awaiting_payment"
        | "in_progress"
        | "delivered"
        | "completed"
        | "cancelled"
        | "disputed"
      payout_status: "none" | "pending" | "paid"
      proposal_status: "submitted" | "accepted" | "rejected" | "withdrawn"
      service_status: "draft" | "published" | "paused" | "archived"
      student_verification_state:
        | "unverified"
        | "pending"
        | "verified"
        | "rejected"
      verification_method: "email_domain" | "document"
      verification_status: "pending" | "approved" | "rejected"
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
      job_status: ["open", "hiring", "filled", "closed"],
      order_source: ["service", "job"],
      order_status: [
        "awaiting_payment",
        "in_progress",
        "delivered",
        "completed",
        "cancelled",
        "disputed",
      ],
      payout_status: ["none", "pending", "paid"],
      proposal_status: ["submitted", "accepted", "rejected", "withdrawn"],
      service_status: ["draft", "published", "paused", "archived"],
      student_verification_state: [
        "unverified",
        "pending",
        "verified",
        "rejected",
      ],
      verification_method: ["email_domain", "document"],
      verification_status: ["pending", "approved", "rejected"],
    },
  },
} as const
