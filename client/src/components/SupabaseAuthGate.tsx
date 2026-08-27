import { type ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

export function SupabaseAuthGate({ children }: { children: ReactNode }) {
  const { loading, user } = useSupabaseAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) setLocation(`/auth?next=${encodeURIComponent(location)}`);
  }, [loading, location, setLocation, user]);

  if (loading || !user) return <main className="auth-gate-loading" aria-live="polite"><span className="auth-mark">◆</span><p>Verifying secure session…</p></main>;
  return <>{children}</>;
}

export function SessionControl() {
  const { user, signOut } = useSupabaseAuth();
  if (!user) return null;
  const label = user.email?.split("@")[0] || "Account";
  return <div className="session-control"><span title={user.email ?? undefined}>{label}</span><button type="button" onClick={() => void signOut()}>Sign out</button></div>;
}
