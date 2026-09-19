"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";

type AuthState = "loading" | "authenticated" | "unauthenticated";

interface AuthContextType {
  state: AuthState;
  user: User | null;
  session: Session | null;
  credits: number | null;
  refreshCredits: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const supabase = getSupabaseClient();

  const fetchCredits = async (currentSession: Session) => {
    try {
      const res = await fetch("/api/auth/balance", {
        headers: {
          Authorization: `Bearer ${currentSession.access_token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setCredits(data.balance);
      }
    } catch (err) {
      console.error("Failed to fetch balance", err);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      
      if (!mounted) return;

      if (error || !currentSession) {
        setState("unauthenticated");
        setUser(null);
        setSession(null);
        setCredits(null);
      } else {
        setState("authenticated");
        setUser(currentSession.user);
        setSession(currentSession);
        fetchCredits(currentSession);
      }
    };

    initializeAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (newSession) {
          setState("authenticated");
          setUser(newSession.user);
          setSession(newSession);
          fetchCredits(newSession);
        }
      } else if (event === 'SIGNED_OUT') {
        setState("unauthenticated");
        setUser(null);
        setSession(null);
        setCredits(null);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    const handleRefreshCredits = () => {
      if (session) {
        fetchCredits(session);
      }
    };

    window.addEventListener("refresh_credits", handleRefreshCredits);
    return () => {
      window.removeEventListener("refresh_credits", handleRefreshCredits);
    };
  }, [session]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshCredits = async () => {
    if (session) {
      await fetchCredits(session);
    }
  };

  const value = {
    state,
    user,
    session,
    credits,
    refreshCredits,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
