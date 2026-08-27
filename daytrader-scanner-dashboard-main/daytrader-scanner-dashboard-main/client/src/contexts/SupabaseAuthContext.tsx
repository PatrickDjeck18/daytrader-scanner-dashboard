import { type Session, type User } from "@supabase/supabase-js";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type SupabaseAuthValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const SupabaseAuthContext = createContext<SupabaseAuthValue | undefined>(undefined);

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const value = useMemo<SupabaseAuthValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    signOut: async () => { await supabase.auth.signOut(); },
  }), [loading, session]);

  return <SupabaseAuthContext.Provider value={value}>{children}</SupabaseAuthContext.Provider>;
}

export function useSupabaseAuth() {
  const value = useContext(SupabaseAuthContext);
  if (!value) throw new Error("useSupabaseAuth must be used inside SupabaseAuthProvider");
  return value;
}
