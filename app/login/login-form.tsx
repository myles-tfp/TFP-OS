"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export function LoginForm({ serverError }: { serverError: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(serverError);
  const [busy, setBusy] = useState(false);

  const friendly = (message: string) => {
    if (/not authorized|allowlist|not_authorized/i.test(message)) {
      return "That email isn't on the franchisee roster yet. Reach out to TFP HQ to get set up.";
    }
    if (/invalid login credentials/i.test(message)) {
      return "That email and password don't match. Double-check and try again.";
    }
    if (/database error saving new user/i.test(message)) {
      return "That email isn't on the franchisee roster yet. Reach out to TFP HQ to get set up.";
    }
    return message;
  };

  const signInWithGoogle = async () => {
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(friendly(error.message));
      setBusy(false);
    }
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(friendly(error.message));
        setBusy(false);
        return;
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(friendly(error.message));
        setBusy(false);
        return;
      }
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div>
      {error && <div className="auth-error">{error}</div>}

      <button
        type="button"
        className="btn full"
        onClick={signInWithGoogle}
        disabled={busy}
      >
        Continue with Google
      </button>

      <div className="divider">or</div>

      <form onSubmit={submitEmail}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yourlocation.com"
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signin" ? "Your password" : "Pick a password (8+ characters)"}
          />
        </div>
        <button type="submit" className="btn ghost full" disabled={busy}>
          {mode === "signin" ? "Sign in with email" : "Create account"}
        </button>
      </form>

      <p className="auth-note">
        {mode === "signin" ? (
          <>
            First time here?{" "}
            <a
              href="#"
              style={{ color: "var(--dillball)" }}
              onClick={(e) => {
                e.preventDefault();
                setMode("signup");
                setError(null);
              }}
            >
              Set up your password
            </a>
          </>
        ) : (
          <>
            Already set up?{" "}
            <a
              href="#"
              style={{ color: "var(--dillball)" }}
              onClick={(e) => {
                e.preventDefault();
                setMode("signin");
                setError(null);
              }}
            >
              Sign in
            </a>
          </>
        )}
      </p>
    </div>
  );
}
