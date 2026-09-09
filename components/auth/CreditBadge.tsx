"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function CreditBadge() {
  const [balance, setBalance] = useState<number | null>(null);
  const supabase = getSupabaseClient();

  useEffect(() => {
    const fetchBalance = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      try {
        const res = await fetch("/api/auth/balance", {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });
        const data = await res.json();
        if (data.success) {
          setBalance(data.balance);
        }
      } catch (err) {
        console.error("Failed to fetch balance", err);
      }
    };

    fetchBalance();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        fetchBalance();
      } else if (event === 'SIGNED_OUT') {
        setBalance(null);
      }
    });

    // Custom event to manually trigger refresh after generation
    const handleRefresh = () => fetchBalance();
    window.addEventListener("refresh_credits", handleRefresh);

    return () => {
      authListener.subscription.unsubscribe();
      window.removeEventListener("refresh_credits", handleRefresh);
    };
  }, [supabase.auth]);

  if (balance === null) return null;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "var(--space-1)",
      padding: "var(--space-1-5) var(--space-3)",
      borderRadius: "var(--radius-full)",
      background: "var(--color-brand-surface)",
      border: "1px solid var(--color-brand-soft)",
      color: "var(--color-brand-primary)", 
      fontSize: "var(--text-sm)", 
      fontWeight: "var(--font-weight-semibold)",
    }}>
      <Zap size={14} />
      <span>{balance} credits</span>
    </div>
  );
}
