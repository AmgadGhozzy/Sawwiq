"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { GenerationHistoryItem } from "@/types/history";

interface HistoryContextType {
  items: GenerationHistoryItem[];
  setItems: (items: GenerationHistoryItem[]) => void;
  selectedHistoryIndex: number | null;
  setSelectedHistoryIndex: (index: number | null) => void;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
}

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

  // Initial silent fetch to load previous session generations
  useEffect(() => {
    let isMounted = true;
    fetch("/api/history?limit=20")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (isMounted && json && json.success && Array.isArray(json.data)) {
          setItems(json.data);
        }
      })
      .catch(() => {
        // silent
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <HistoryContext.Provider
      value={{
        items,
        setItems,
        selectedHistoryIndex,
        setSelectedHistoryIndex,
        isDrawerOpen,
        setIsDrawerOpen,
      }}
    >
      {children}
    </HistoryContext.Provider>
  );
}
