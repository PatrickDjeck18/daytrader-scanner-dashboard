import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ChevronLeft, KeyRound, LoaderCircle, LockKeyhole, Mail, ShieldCheck, TriangleAlert } from "lucide-react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

type AuthMode = "sign-in" | "sign-up" | "recover" | "update-password";

function redirectPath(search: string) {
  const next = new URLSearchParams(search).get("next");
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default function AuthPage({ initialMode = "sign-in" }: { initialMode?: AuthMode }) {
  const { user, loading } = useSupabaseAuth();
  const [location, setLocation] = useLocation();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const next = useMemo(() => redirectPath(location.split("?")[1] ?? ""), [location]);

  useEffect(() => {
    if (!loading && user && mode !== "update-password") setLocation(next);
  }, [loading, mode, next, setLocation, user]);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("update-password");
        setMessage("Choose a new password for your account.");
        setError(undefined);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const switchMode = (nextMode: AuthMode) => { setMode(nextMode); setError(undefined); setMessage(undefined); setPassword(""); setConfirmPassword(""); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(undefined); setMessage(undefined);
    if (password.length < 8 && mode !== "recover") { setError("Use a password with at least 8 characters."); return; }
    if ((mode === "sign-up" || mode === "update-password") && password !== confirmPassword) { setError("Passwords do not match."); return; }
    setSubmitting(true);
    try {
      const callback = `${window.location.origin}/auth/callback`;
      if (mode === "sign-in") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        setLocation(next);
      } else if (mode === "sign-up") {
        const { data, error: authError } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callback } });
        if (authError) throw authError;
        if (data.session) setLocation(next);
        else setMessage("Check your inbox to confirm your email, then return to sign in.");
      } else if (mode === "recover") {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/reset` });
        if (authError) throw authError;
        setMessage("If that email is registered, a password-reset link has been sent.");
      } else {
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError;
        setMessage("Password updated. Redirecting to your dashboard…");
        window.setTimeout(() => setLocation(next), 700);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication could not be completed. Please try again.");
    } finally { setSubmitting(false); }
  };

  const title = mode === "sign-in" ? "Welcome back" : mode === "sign-up" ? "Create your terminal" : mode === "recover" ? "Reset access" : "Set a new password";
  const description = mode === "sign-in" ? "Sign in to unlock your private dashboards and saved workspace." : mode === "sign-up" ? "Create a secure Supabase account for your saved trading workspace." : mode === "recover" ? "We will send a secure reset link if an account exists for this address." : "Your reset link is verified. Choose a new secure password.";

  return <main className="auth-shell"><section className="auth-brief"><div className="auth-brand"><span>◆</span> ARCANE<small>MONITOR</small></div><div><p className="auth-eyebrow">PRIVATE WORKSPACE</p><h1>One secure session.<br />Two focused dashboards.</h1><p>Access the U.S. equities scanner and Binance crypto terminal with Supabase authentication and user-isolated saved data.</p></div><div className="auth-assurance"><div><ShieldCheck size={16} /><span><b>Supabase-backed identity</b><small>Email/password sessions managed by Supabase Auth.</small></span></div><div><LockKeyhole size={16} /><span><b>Private workspace data</b><small>Layouts, watchlists, alerts, and paper history are scoped to your account.</small></span></div></div></section><section className="auth-panel"><div className="auth-card"><div className="auth-card-heading"><p className="auth-eyebrow">SECURE ACCESS</p><h2>{title}</h2><p>{description}</p></div>{message ? <div className="auth-message success"><CheckCircle2 size={16} />{message}</div> : null}{error ? <div className="auth-message error"><TriangleAlert size={16} />{error}</div> : null}<form onSubmit={submit}><label>Email{mode !== "update-password" ? <span className="auth-input"><Mail size={15} /><input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" required /></span> : null}</label>{mode !== "recover" ? <label>{mode === "update-password" ? "New password" : "Password"}<span className="auth-input"><KeyRound size={15} /><input type="password" autoComplete={mode === "sign-up" ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" required /></span></label> : null}{mode === "sign-up" || mode === "update-password" ? <label>Confirm password<span className="auth-input"><KeyRound size={15} /><input type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder="Repeat your password" required /></span></label> : null}<button className="auth-submit" type="submit" disabled={submitting}>{submitting ? <LoaderCircle className="spin" size={16} /> : <ArrowRight size={16} />}{mode === "sign-in" ? "Sign in" : mode === "sign-up" ? "Create account" : mode === "recover" ? "Send reset link" : "Update password"}</button></form>{mode === "sign-in" ? <div className="auth-links"><button type="button" onClick={() => switchMode("recover")}>Forgot password?</button><span>New here?</span><button type="button" onClick={() => switchMode("sign-up")}>Create an account</button></div> : <div className="auth-links"><button type="button" onClick={() => switchMode("sign-in")}><ChevronLeft size={13} />Back to sign in</button></div>}<p className="auth-footnote">By continuing, you access paper-only market tools. No live orders are available.</p></div></section></main>;
}

export function AuthCallbackPage() {
  const { loading, user } = useSupabaseAuth();
  const [location, setLocation] = useLocation();
  const next = useMemo(() => redirectPath(location.split("?")[1] ?? ""), [location]);
  useEffect(() => { if (!loading && user) setLocation(next); }, [loading, next, setLocation, user]);
  return <main className="auth-gate-loading"><span className="auth-mark">◆</span><p>{user ? "Opening your workspace…" : "Confirming your secure session…"}</p></main>;
}
