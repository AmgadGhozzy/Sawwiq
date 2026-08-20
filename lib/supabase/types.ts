// ---------------------------------------------------------------------------
// Supabase Database Types
// Mirrors migrations 001–004
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
          request_id: string | null;
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
          request_id?: string | null | undefined;
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
          request_id?: string | null | undefined;
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
          fingerprint_hash: string | null;
          client_ip: string | null;
          created_at: string;
        };
        Insert: {
          id?: string | undefined;
          session_id?: string | null | undefined;
          email: string;
          fingerprint_hash?: string | null | undefined;
          client_ip?: string | null | undefined;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          session_id?: string | null | undefined;
          email?: string | undefined;
          fingerprint_hash?: string | null | undefined;
          client_ip?: string | null | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      persist_generation: {
        Args: {
          p_session_id: string;
          p_request_id: string;
          p_prompt: string;
          p_platform: string;
          p_content_type: string;
          p_arabic_style: string;
          p_ai_response: Json;
        };
        Returns: Json;
      };
      register_waitlist: {
        Args: {
          p_email: string;
          p_session_id: string | null;
          p_fingerprint_hash: string | null;
          p_client_ip: string | null;
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
