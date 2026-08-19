// ---------------------------------------------------------------------------
// Supabase Database Types
// Mirrors the schema in supabase/migrations/001_initial_schema.sql
//
// NOTE: These types follow the exact shape required by @supabase/supabase-js
// generic typing system. Do not simplify the Row/Insert/Update structure.
// ---------------------------------------------------------------------------

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      sessions: {
        Row: {
          id: string;
          session_token: string;
          generations_count: number;
          max_limit: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string | undefined;
          session_token: string;
          generations_count?: number | undefined;
          max_limit?: number | undefined;
          created_at?: string | undefined;
          updated_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          session_token?: string | undefined;
          generations_count?: number | undefined;
          max_limit?: number | undefined;
          created_at?: string | undefined;
          updated_at?: string | undefined;
        };
        Relationships: [];
      };
      generations: {
        Row: {
          id: string;
          session_id: string | null;
          prompt: string;
          platform: string;
          content_type: string;
          arabic_style: string;
          ai_response: Json;
          created_at: string;
        };
        Insert: {
          id?: string | undefined;
          session_id?: string | null | undefined;
          prompt: string;
          platform: string;
          content_type: string;
          arabic_style: string;
          ai_response: Json;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          session_id?: string | null | undefined;
          prompt?: string | undefined;
          platform?: string | undefined;
          content_type?: string | undefined;
          arabic_style?: string | undefined;
          ai_response?: Json | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
      waitlist: {
        Row: {
          id: string;
          session_id: string | null;
          email: string;
          created_at: string;
        };
        Insert: {
          id?: string | undefined;
          session_id?: string | null | undefined;
          email: string;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          session_id?: string | null | undefined;
          email?: string | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
