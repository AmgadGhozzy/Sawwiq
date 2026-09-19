"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import type { GenerationHistoryItem } from "@/types/history";
import { getSupabaseClient } from "@/lib/supabase/client";

interface HistoryContextType {
  items: GenerationHistoryItem[];
  setItems: (items: GenerationHistoryItem[]) => void;
  selectedHistoryIndex: number | null;
  setSelectedHistoryIndex: (index: number | null) => void;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  refreshHistory: () => Promise<boolean>;
}

// Server-verified identity for /api/history: sends the Supabase access token
// when logged in (user_id rows), empty headers when anonymous (session rows).
// Never throws — falls back to anonymous on any failure.
const getAuthHeaders = async (): Promise<Record<string, string>> => {
  try {
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  } catch {
    return {};
  }
};

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

export function useHistoryContext() {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error("useHistoryContext must be used within a HistoryContextProvider");
  }
  return context;
}

export function HistoryContextProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<GenerationHistoryItem[]>([]);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Single source of truth: silent fetch used by the initial load,
  // drawer opens, and post-generation reconciliation (server-canonical rows)
  const refreshHistory = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/history?limit=20", { headers });
      if (!res.ok) return false;
      const json = await res.json();
      if (json && json.success && Array.isArray(json.data)) {
        setItems(json.data);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  // Initial silent fetch to load previous generations (session + user rows)
  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  return (
    <HistoryContext.Provider
      value={{
        items,
        setItems,
        selectedHistoryIndex,
        setSelectedHistoryIndex,
        isDrawerOpen,
        setIsDrawerOpen,
        refreshHistory,
      }}
    >
      {children}
    </HistoryContext.Provider>
  );
}
