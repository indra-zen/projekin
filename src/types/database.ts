/**
 * Supabase database types for the identity schema.
 *
 * HAND-WRITTEN to mirror supabase/migrations/2026111308*.sql because type
 * generation needs a reachable database. Replace this file with the generated
 * output as soon as the dev project is linked:
 *
 *   npx supabase gen types typescript --project-id <dev-ref> > src/types/database.ts
 *
 * Keep the shape compatible with `supabase gen types` (type aliases, not interfaces).
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type ProfileRow = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_path: string | null;
  bio: string | null;
  location: string | null;
  terms_accepted_at: string | null;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
};

type StudentVerificationRow = {
  id: string;
  user_id: string;
  university_id: string;
  method: Database["public"]["Enums"]["verification_method"];
  verified_email: string | null;
  student_number: string | null;
  document_path: string | null;
  status: Database["public"]["Enums"]["verification_status"];
  valid_until: string | null;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: never;
        Update: {
          full_name?: string | null;
          username?: string;
          bio?: string | null;
          location?: string | null;
          avatar_path?: string | null;
        };
        Relationships: [];
      };
      admin_users: {
        Row: { user_id: string; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "admin_users_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      universities: {
        Row: {
          id: string;
          name: string;
          short_name: string | null;
          email_domains: string[];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      student_verifications: {
        Row: StudentVerificationRow;
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "student_verifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_verifications_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_verifications_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
      freelancer_profiles: {
        Row: {
          user_id: string;
          university_id: string;
          verified_until: string;
          status: Database["public"]["Enums"]["freelancer_status"];
          headline: string | null;
          skills: string[];
          major: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: {
          headline?: string | null;
          skills?: string[];
          major?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "freelancer_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "freelancer_profiles_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      complete_onboarding: {
        Args: {
          p_full_name: string;
          p_username: string;
          p_accept_terms: boolean;
        };
        Returns: ProfileRow;
      };
      get_my_verification_status: {
        Args: Record<string, never>;
        Returns: {
          state: Database["public"]["Enums"]["student_verification_state"];
          is_suspended: boolean;
          verified_until: string | null;
          university_id: string | null;
          latest_request_id: string | null;
          latest_request_status:
            Database["public"]["Enums"]["verification_status"] | null;
          latest_rejection_reason: string | null;
          can_submit: boolean;
        }[];
      };
      submit_student_verification: {
        Args: {
          p_university_id: string;
          p_method: Database["public"]["Enums"]["verification_method"];
          p_student_number?: string | null;
          p_document_path?: string | null;
        };
        Returns: StudentVerificationRow;
      };
      review_student_verification: {
        Args: {
          p_verification_id: string;
          p_decision: string;
          p_valid_until?: string | null;
          p_reason?: string | null;
        };
        Returns: StudentVerificationRow;
      };
    };
    Enums: {
      verification_method: "email_domain" | "document";
      verification_status: "pending" | "approved" | "rejected";
      freelancer_status: "active" | "suspended";
      student_verification_state:
        "unverified" | "pending" | "verified" | "rejected";
    };
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];
