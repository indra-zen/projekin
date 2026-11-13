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
      [_ in never]: never
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
    },
  },
} as const
