// ---------------------------------------------------------------------------
// Supabase Database Types
// Mirrors migrations 001–004 + 20260910000000_credits_and_auth
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
          user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string | undefined;
          session_token: string;
          generations_count?: number | undefined;
          max_limit?: number | undefined;
          user_id?: string | null | undefined;
          created_at?: string | undefined;
          updated_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          session_token?: string | undefined;
          generations_count?: number | undefined;
          max_limit?: number | undefined;
          user_id?: string | null | undefined;
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
          metadata: Json;
          user_id: string | null;
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
          metadata?: Json | undefined;
          user_id?: string | null | undefined;
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
          metadata?: Json | undefined;
          user_id?: string | null | undefined;
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
      user_credits: {
        Row: {
          user_id: string;
          balance: number;
          lifetime_earned: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          balance?: number | undefined;
          lifetime_earned?: number | undefined;
          updated_at?: string | undefined;
        };
        Update: {
          user_id?: string | undefined;
          balance?: number | undefined;
          lifetime_earned?: number | undefined;
          updated_at?: string | undefined;
        };
        Relationships: [];
      };
      credit_transactions: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          reason: string;
          idempotency_key: string | null;
          generation_request_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string | undefined;
          user_id: string;
          amount: number;
          reason: string;
          idempotency_key?: string | null | undefined;
          generation_request_id?: string | null | undefined;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          user_id?: string | undefined;
          amount?: number | undefined;
          reason?: string | undefined;
          idempotency_key?: string | null | undefined;
          generation_request_id?: string | null | undefined;
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
          p_metadata?: Json;
          p_user_id?: string | null;
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
      award_credits: {
        Args: {
          p_user_id: string;
          p_amount: number;
          p_reason: string;
          p_idempotency_key: string;
        };
        Returns: Json;
      };
      deduct_credit: {
        Args: {
          p_user_id: string;
          p_request_id: string;
          p_credit_cost?: number;
        };
        Returns: Json;
      };
      refund_credit: {
        Args: {
          p_user_id: string;
          p_request_id: string;
        };
        Returns: Json;
      };
      get_credit_balance: {
        Args: {
          p_user_id: string;
        };
        Returns: Json;
      };
      claim_and_merge_session: {
        Args: {
          p_user_id: string;
          p_session_token: string;
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
